import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePlant } from '../contexts/PlantContext';
import { LayoutDashboard, LogOut, FileUp, FileText, FileSearch, ArrowRight, X, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatDate } from '../lib/utils';
import { Card, CardContent } from '../components/ui/Card';

export default function Dashboard() {
  const { user, profile, profileError, loading: authLoading, signOut } = useAuth();
  const { activePlant } = usePlant();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<'on' | 'po'>('on');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/login');
      return;
    }

    if (!activePlant?.id) {
      setLoading(false);
      return;
    }

    if (profile?.organization_id) {
      setLoading(true);
      setJobs([]);
      fetchJobs();
      
      // Optionally subscribe to realtime updates on jobs for this organization
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
            filter: `organization_id=eq.${profile.organization_id}`
          },
          () => {
            fetchJobs();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoading(false);
    }
  }, [user, profile, authLoading, activePlant?.id, navigate]);

  const fetchJobs = async () => {
    if (!profile?.organization_id || !activePlant?.id) {
      setLoading(false);
      return;
    }
    setJobsError(null);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          delivery_notes ( * )
        `)
        .eq('organization_id', profile.organization_id)
        .eq('plant_id', activePlant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (e: any) {
      console.error('Error fetching jobs:', e);
      setJobsError(`Failed to fetch jobs: ${e.message} (Code: ${e.code})`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) {
      setUploadError('Please select a file to upload.');
      return;
    }
    
    if (!profile?.organization_id) {
      setUploadError('Wait! Your user account does not have an organization assigned in the "profiles" table. Please configure it in Supabase first.');
      return;
    }

    if (!activePlant?.id) {
      setUploadError('No plant selected. Please choose a plant first.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const timestamp = new Date().getTime();
      const fileExt = selectedFile.name.split('.').pop();
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileName = `${profile.organization_id}/${timestamp}_${safeName}`;

      // Upload file to storage
      // For now, all input uploads go to 'scanned-ons'
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('scanned-ons')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL or signed URL (using path based on config)
      const fileUrl = uploadData.path;

      // Create job record
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          created_by: user.id,
          organization_id: profile.organization_id,
          plant_id: activePlant.id,
          source_filename: selectedFile.name,
          source_file_path: fileUrl,
          status: 'uploaded',
        })
        .select()
        .single();

      if (jobError) throw jobError;

      try {
        // Invoke OCR
        const { error: ocrError } = await supabase.functions.invoke('ocr-delivery-note', {
          body: { job_id: jobData.id, file_path: fileUrl }
        });
        if (ocrError) throw new Error(`OCR processing failed: ${ocrError.message || JSON.stringify(ocrError)}`);
        
        // Invoke Render
        const { data: renderData, error: renderError } = await supabase.functions.invoke('render-delivery-note', {
          body: { job_id: jobData.id }
        });
        if (renderError) throw new Error(`Render processing failed: ${renderError.message || JSON.stringify(renderError)}`);

        // If the Edge functions don't update the status themselves, do it here.
        if (renderData && renderData.ok && renderData.file_path) {
          await supabase.from('jobs').update({
             status: 'pdf_generated',
             generated_pdf_path: renderData.file_path
          }).eq('id', jobData.id);
        } else {
          // Fallback just update status so UI unblocks
          await supabase.from('jobs').update({ status: 'pdf_generated' }).eq('id', jobData.id);
        }
      } catch (invokeError: any) {
        // We log the error but do not fail the upload itself. The job is already in the DB.
        console.error("Edge function invocation error:", invokeError);
        setUploadError(`Document uploaded, but processing failed: ${invokeError.message}. Please check the console or Edge Function logs.`);
        setUploading(false);
        fetchJobs();
        return; // Early return to keep the modal open and show the error
      }

      setIsUploadModalOpen(false);
      setSelectedFile(null);
      fetchJobs();
    } catch (err: any) {
      console.error('Upload error:', err);
      // More descriptive error output
      const errorMsg = err.message || JSON.stringify(err);
      if (errorMsg.includes('bucket') || errorMsg.includes('storage') || errorMsg.includes('Bucket not found') || err.error === 'Bucket not found') {
         setUploadError(`Storage Error: Bucket not found. \n\nNote: Please make sure your "scanned-ons" bucket is public and allows uploads, or that you have the proper RLS policies set for the "scanned-ons" storage bucket in Supabase.`);
      } else {
         setUploadError(`Upload Failed: ${errorMsg}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (job: any) => {
    if (job.generated_pdf_path) {
      try {
        const pathParts = job.generated_pdf_path.split('/');
        const bucket = pathParts[0];
        const filePath = pathParts.slice(1).join('/');

        console.log("Trying to get signed url for bucket:", bucket, "filePath:", filePath);
        let signedUrlData = await supabase.storage.from(bucket).createSignedUrl(filePath, 60);
        
        // If that fails, it might be that the edge function uploaded it as the exact string 'delivery-notes/...' inside 'delivery-notes' bucket (or some other bucket).
        if (signedUrlData.error) {
           console.log("First attempt failed:", signedUrlData.error.message);
           console.log("Trying literal path in delivery-notes bucket...");
           signedUrlData = await supabase.storage.from('delivery-notes').createSignedUrl(job.generated_pdf_path, 60);
        }

        if (signedUrlData.error) {
          console.warn("Storage PDF not found or inaccessible:", signedUrlData.error.message);
          console.log("Falling back to HTML view");
          navigate(`/delivery-note/${job.id}`);
        } else if (signedUrlData.data?.signedUrl) {
          window.open(signedUrlData.data.signedUrl, '_blank');
        }
      } catch (err) {
        console.error("Exception loading Document:", err);
      }
    } else {
      navigate(`/delivery-note/${job.id}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploaded':
        return <Badge variant="info">Uploaded</Badge>;
      case 'extracting':
      case 'extracted':
        return <Badge variant="warning">Processing</Badge>;
      case 'pdf_generated':
        return <Badge variant="success">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getNoteValue = (note: any, key: string) => {
    if (!note) return null;
    const lowerKey = key.toLowerCase();
    const actualKey = Object.keys(note).find(k => k.toLowerCase() === lowerKey);
    const val = actualKey ? note[actualKey] : null;
    return val !== null && val !== undefined && val !== '' ? String(val) : null;
  };

  const getFirstNote = (job: any) => {
    if (!job || !job.delivery_notes) return null;
    if (Array.isArray(job.delivery_notes)) {
      return job.delivery_notes.length > 0 ? job.delivery_notes[0] : null;
    }
    if (typeof job.delivery_notes === 'object') {
      return job.delivery_notes;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <LayoutDashboard className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Delivery Notes</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <p className="font-medium text-gray-900">{profile?.organizations?.name || 'Loading...'}</p>
              <p className="text-gray-500">{user?.email}</p>
            </div>
            {activePlant && (
              <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
                <span className="text-xs text-gray-600 font-medium">
                  {activePlant.plant_code} - {activePlant.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/select-plant')}
                  className="text-xs text-blue-600 hover:text-blue-700 h-8 px-2"
                >
                  Change plant
                </Button>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-gray-900">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Recent Jobs</h2>
            <p className="text-sm text-gray-500 mt-1">Manage and view delivery notes for the selected plant</p>
          </div>
          <div className="flex space-x-3">
            <Button onClick={() => {
              setIsUploadModalOpen(true);
              setUploadError(null);
            }}>
              <FileUp className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </div>

        {!profile?.organization_id && !loading && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Missing Organization or Profile Fetch Error</h3>
                <div className="mt-2 text-sm text-yellow-700 space-y-2">
                  <p>
                    <strong className="font-bold">Missing Organization:</strong> Your user account does not have an organization assigned, or there was an error fetching your profile. 
                  </p>
                  
                  {profileError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded mt-2 font-mono text-xs">
                      <strong>Database Error:</strong> {profileError}
                    </div>
                  )}
                  
                  <div className="mt-2">
                    Please go to the Supabase dashboard:
                    <ul className="list-disc ml-5 mt-1">
                      <li>Check that your user record in the <code className="bg-yellow-100 px-1 rounded">profiles</code> table has <code className="bg-yellow-100 px-1 rounded">organization_id</code> set.</li>
                      <li>Check your <strong>RLS Policies</strong> on the <code className="bg-yellow-100 px-1 rounded">profiles</code> table. If RLS is enabled without a policy allowing your user to SELECT, it will return nothing.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {jobsError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error Loading Jobs</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{jobsError}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Document</th>
                    <th className="px-6 py-4">ON</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Destination</th>
                    <th className="px-6 py-4">Date Uploaded</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        <FileSearch className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                        <p className="text-lg font-medium text-gray-900">No jobs found</p>
                        <p className="mt-1">Upload an Order Note (ON) or Purchase Order (PO) to get started.</p>
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => {
                      const note = getFirstNote(job);
                      return (
                      <tr key={job.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="font-medium text-gray-900 truncate max-w-xs" title={
                                getNoteValue(note, 'delivery_note_number') || getNoteValue(note, 'delivery_note_no') || 'Unknown Note'
                              }>
                                {getNoteValue(note, 'delivery_note_number') || getNoteValue(note, 'delivery_note_no') || 'Unknown Note'}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5" title={job.source_filename}>
                                Orig: {job.source_filename}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-900 font-medium">
                          {getNoteValue(note, 'order_no') ?? '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-900">
                          {getNoteValue(note, 'deliver_to_name') ?? '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-900">
                          {getNoteValue(note, 'deliver_to_town') ?? '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {formatDate(job.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(job.status)}
                          {job.status === 'failed' && job.error_message && (
                            <p className="text-xs text-red-500 mt-1 truncate max-w-[150px]" title={job.error_message}>
                              {job.error_message}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant={job.status === 'pdf_generated' ? 'primary' : 'outline'} 
                            size="sm"
                            onClick={() => handleViewDocument(job)}
                            disabled={job.status !== 'pdf_generated'}
                            className="bg-white border-gray-200 text-gray-900 hover:bg-gray-50 hover:text-blue-600 disabled:opacity-50"
                          >
                            View Document
                            {job.status === 'pdf_generated' && <ArrowRight className="h-4 w-4 ml-2" />}
                          </Button>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold">Upload Document</h3>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpload}>
              <CardContent className="p-6 space-y-6">
                {uploadError && (
                  <div className="rounded-md bg-red-50 py-3 px-4 text-sm text-red-600 font-medium whitespace-pre-wrap break-words border border-red-100">
                    {uploadError}
                  </div>
                )}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-900 block">Document Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label 
                      className={`flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer transition-all ${documentType === 'on' ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-600'}`}
                    >
                      <input 
                        type="radio" 
                        name="type" 
                        value="on" 
                        checked={documentType === 'on'} 
                        onChange={() => setDocumentType('on')} 
                        className="sr-only" 
                      />
                      <span className="font-semibold text-lg uppercase mb-1">ON</span>
                      <span className="text-xs opacity-80 text-center">Order Note</span>
                    </label>
                    <label 
                      className={`flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer transition-all ${documentType === 'po' ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600' : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-600'}`}
                    >
                      <input 
                        type="radio" 
                        name="type" 
                        value="po" 
                        checked={documentType === 'po'} 
                        onChange={() => setDocumentType('po')} 
                        className="sr-only" 
                      />
                      <span className="font-semibold text-lg uppercase mb-1">PO</span>
                      <span className="text-xs opacity-80 text-center">Purchase Order</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-900 block">File</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors group">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                        <FileUp className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">Click to browse</span>
                      <span className="text-xs text-gray-500 mt-1">PDF or Image (max 10MB)</span>
                    </label>
                    {selectedFile && (
                      <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg flex items-center">
                        <FileText className="h-4 w-4 text-blue-500 mr-2 shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{selectedFile.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
              <div className="p-6 pt-0 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsUploadModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!selectedFile} isLoading={uploading}>
                  Upload & Process
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
