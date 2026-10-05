import { useNavigate } from 'react-router-dom';
import { usePlant } from '../contexts/PlantContext';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Building2, ChevronRight, AlertTriangle, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SelectPlant() {
  const { plants, activePlant, loading, error, setActivePlant, refreshPlants } = usePlant();
  const navigate = useNavigate();

  const handleSelectPlant = (plantId: string) => {
    setActivePlant(plantId);
    navigate('/');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-2">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Select Plant</CardTitle>
          <CardDescription>
            Choose an assigned plant to continue to delivery notes.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="space-y-3">
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 font-medium whitespace-pre-wrap break-all flex items-start gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
              <Button type="button" onClick={() => refreshPlants()} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {!error && plants.length === 0 && (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-600">
                No plant is assigned to your account. Contact the administrator.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          )}

          {!error && plants.length > 0 && (
            <div className="space-y-3">
              {plants.map((plant) => {
                const isSelected = activePlant?.id === plant.id;
                return (
                  <button
                    key={plant.id}
                    type="button"
                    onClick={() => handleSelectPlant(plant.id)}
                    className={cn(
                      'w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group',
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500'
                        : 'border-gray-200 bg-white hover:border-blue-400 hover:bg-gray-50/80 hover:shadow-sm'
                    )}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-bold text-sm tracking-wide',
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors'
                        )}
                      >
                        {plant.plant_code || 'PL'}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {plant.name || 'Unnamed Plant'}
                        </div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">
                          Code: {plant.plant_code}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={cn(
                        'h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all'
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>

        {!error && plants.length > 0 && (
          <CardFooter className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 font-medium transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
