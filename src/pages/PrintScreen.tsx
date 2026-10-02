import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function PrintScreen() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (id) {
      fetchDeliveryNote(id);
    }
  }, [id, user, navigate]);

  const fetchDeliveryNote = async (jobId: string) => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          delivery_notes (
            *,
            delivery_note_items (*)
          ),
          organizations(name)
        `)
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      
      if (jobData?.delivery_notes?.[0]) {
        setData(jobData);
      } else {
        throw new Error('Delivery note not found for this job');
      }
    } catch (e) {
      console.error('Error fetching delivery note:', e);
      alert('Could not load delivery note. It may not be ready yet.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) return null;

  const note = data.delivery_notes[0];
  const items = note.delivery_note_items || [];
  const orgName = data.organizations?.name || 'Kimberly-Clark';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Non-printable top action bar */}
      <div className="print:hidden bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="-ml-4 text-gray-600">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="h-4 w-4 mr-2" />
            Print Note
          </Button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="flex-1 overflow-auto p-8 print:p-0">
        <div className="max-w-4xl mx-auto bg-white p-12 shadow-sm rounded-xl print:shadow-none print:rounded-none print:p-0">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-8">
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-wider text-slate-900">Delivery Note</h1>
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500 mt-1">{orgName}</p>
            </div>
            <div className="text-right">
              {/* Here we could put a logo if available */}
              <div className="h-10 w-32 bg-slate-100 flex items-center justify-center rounded text-slate-400 font-bold mb-4 print:border">LOGO</div>
            </div>
          </div>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-12">
            <div>
              <div className="mb-4">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Del. Note #</span>
                <span className="text-lg font-mono font-medium text-slate-900">{note.delivery_note_number || '-'}</span>
              </div>
              <div className="mb-4">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">PO Number</span>
                <span className="text-lg font-mono font-medium text-slate-900">{note.po_number || '-'}</span>
              </div>
              <div className="mb-4">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Load Number</span>
                <span className="text-lg font-mono font-medium text-slate-900">{note.load_number || '-'}</span>
              </div>
            </div>
            <div>
              <div className="mb-4">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ship Date</span>
                <span className="text-lg font-medium text-slate-900">{note.ship_date || '-'}</span>
              </div>
              <div className="mb-4">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Carrier</span>
                <span className="text-lg font-medium text-slate-900">{note.carrier_name || '-'}</span>
              </div>
            </div>
          </div>

          {/* Additional Info block if available */}
          <div className="grid grid-cols-2 gap-x-12 mb-12 bg-slate-50 p-6 rounded-lg print:border print:bg-transparent">
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ship From</span>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.ship_from_address || 'Address not extracted'}</p>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ship To</span>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.ship_to_address || 'Address not extracted'}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-12">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">Line Items</h3>
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-slate-200 text-slate-500">
                  <th className="pb-3 font-semibold w-12">#</th>
                  <th className="pb-3 font-semibold">Material</th>
                  <th className="pb-3 font-semibold">Description</th>
                  <th className="pb-3 font-semibold text-right">Quantity</th>
                  <th className="pb-3 font-semibold text-right w-24">UOM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 italic">No line items extracted.</td>
                  </tr>
                ) : (
                  items.map((item: any, index: number) => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="py-4 text-slate-400 font-mono">{index + 1}</td>
                      <td className="py-4 font-mono font-medium">{item.material_number}</td>
                      <td className="py-4 whitespace-normal min-w-[200px] max-w-[400px]">{item.description || '-'}</td>
                      <td className="py-4 text-right font-mono font-medium">{item.quantity}</td>
                      <td className="py-4 text-right text-slate-500 uppercase">{item.uom || 'EA'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Notes */}
          <div className="mt-16 pt-8 border-t border-slate-200 text-xs text-slate-400 space-y-1">
            <p>Generated by Delivery Notes System.</p>
            <p>Original file: {data.original_filename}</p>
            <p className="font-mono mt-2 text-slate-300">Job ID: {data.id}</p>
          </div>

        </div>
      </div>

    </div>
  );
}
