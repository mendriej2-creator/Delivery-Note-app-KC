import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface Plant {
  id: string;
  plant_code: string;
  name: string;
}

export interface PlantContextType {
  plants: Plant[];
  activePlant: Plant | null;
  loading: boolean;
  error: string | null;
  setActivePlant: (plantId: string) => void;
  refreshPlants: () => Promise<void>;
  clearActivePlant: () => void;
}

const STORAGE_KEY = 'dn_active_plant_id';

const PlantContext = createContext<PlantContextType | undefined>(undefined);

export function PlantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [activePlant, setActivePlantState] = useState<Plant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlantsForUser = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('user_plants')
        .select('plant_id, plants(id, plant_code, name)')
        .eq('user_id', userId);

      if (fetchErr) {
        throw fetchErr;
      }

      const flatPlants: Plant[] = [];
      if (Array.isArray(data)) {
        for (const row of data) {
          const rawPlant = (row as any)?.plants;
          if (!rawPlant) continue;

          if (Array.isArray(rawPlant)) {
            for (const p of rawPlant) {
              if (p && p.id) {
                flatPlants.push({
                  id: String(p.id),
                  plant_code: String(p.plant_code ?? ''),
                  name: String(p.name ?? ''),
                });
              }
            }
          } else if (rawPlant && rawPlant.id) {
            flatPlants.push({
              id: String(rawPlant.id),
              plant_code: String(rawPlant.plant_code ?? ''),
              name: String(rawPlant.name ?? ''),
            });
          }
        }
      }

      // Deduplicate plants by id
      const uniquePlants = Array.from(
        new Map(flatPlants.map((p) => [p.id, p])).values()
      );

      setPlants(uniquePlants);

      const savedPlantId = localStorage.getItem(STORAGE_KEY);
      const matchingPlant = savedPlantId
        ? uniquePlants.find((p) => p.id === savedPlantId)
        : null;

      if (matchingPlant) {
        setActivePlantState(matchingPlant);
      } else if (uniquePlants.length === 1) {
        setActivePlantState(uniquePlants[0]);
        localStorage.setItem(STORAGE_KEY, uniquePlants[0].id);
      } else {
        setActivePlantState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err: any) {
      console.error('Error fetching user plants:', err);
      setError(err?.message || 'Failed to load plants.');
      setPlants([]);
      setActivePlantState(null);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setPlants([]);
      setActivePlantState(null);
      setError(null);
      localStorage.removeItem(STORAGE_KEY);
      setLoading(false);
      return;
    }

    fetchPlantsForUser(user.id);
  }, [user?.id, authLoading, fetchPlantsForUser]);

  const setActivePlant = useCallback((plantId: string) => {
    setPlants((currentPlants) => {
      const chosen = currentPlants.find((p) => p.id === plantId) || null;
      setActivePlantState(chosen);
      if (chosen) {
        localStorage.setItem(STORAGE_KEY, chosen.id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      return currentPlants;
    });
  }, []);

  const clearActivePlant = useCallback(() => {
    setActivePlantState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshPlants = useCallback(async () => {
    if (user?.id) {
      await fetchPlantsForUser(user.id);
    }
  }, [user?.id, fetchPlantsForUser]);

  return (
    <PlantContext.Provider
      value={{
        plants,
        activePlant,
        loading,
        error,
        setActivePlant,
        refreshPlants,
        clearActivePlant,
      }}
    >
      {children}
    </PlantContext.Provider>
  );
}

export function usePlant() {
  const context = useContext(PlantContext);
  if (!context) {
    throw new Error('usePlant must be used within a PlantProvider');
  }
  return context;
}
