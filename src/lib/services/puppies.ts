import { supabase } from '../supabase';
import type { Puppy, PuppyMembership, BreedProfile } from '../database.types';
import { createInviteCode } from './invite-codes';

export interface CreatePuppyData {
  name: string;
  breed: string;
  date_of_birth: string;
  breed_size: string;
  energy_level: string;
  is_brachycephalic: boolean;
  age_months?: number;
  age_weeks?: number;
  weight_value: number | null;
  weight_unit: string;
  photo_url?: string | null;
  questionnaire_data?: {
    wakeUpTime: string;
    bedTime: string;
  };
}

export async function createPuppy(userId: string, data: CreatePuppyData): Promise<Puppy> {
  console.log('createPuppy: inserting puppy for user', userId);

  const { data: puppy, error: puppyError } = await supabase
    .from('puppies')
    .insert({
      name: data.name,
      breed: data.breed,
      date_of_birth: data.date_of_birth,
      breed_size: data.breed_size,
      energy_level: data.energy_level,
      is_brachycephalic: data.is_brachycephalic,
      age_months: data.age_months ?? 0,
      age_weeks: data.age_weeks ?? 0,
      weight_value: data.weight_value,
      weight_unit: data.weight_unit,
      photo_url: data.photo_url,
      questionnaire_data: data.questionnaire_data,
    })
    .select()
    .single();

  if (puppyError) {
    console.error('createPuppy: error inserting puppy:', puppyError);
    throw puppyError;
  }
  console.log('createPuppy: puppy created with id', puppy.id);

  const { error: memberError } = await supabase
    .from('puppy_memberships')
    .insert({
      puppy_id: puppy.id,
      user_id: userId,
      role: 'owner',
    });

  if (memberError) {
    console.error('createPuppy: error creating membership:', memberError);
    // Clean up the orphaned puppy row
    await supabase.from('puppies').delete().eq('id', puppy.id);
    throw memberError;
  }
  console.log('createPuppy: owner membership created');

  try {
    const code = await createInviteCode(puppy.id, data.name, userId);
    console.log('createPuppy: invite code created:', code);
  } catch (err) {
    console.error('createPuppy: invite code generation failed (non-critical):', err);
  }

  return puppy;
}

export async function getUserPuppies(userId: string): Promise<(PuppyMembership & { puppy: Puppy })[]> {
  const { data, error } = await supabase
    .from('puppy_memberships')
    .select('*, puppy:puppies(*)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) throw error;
  return (data || []) as any;
}

export async function getPuppy(puppyId: string): Promise<Puppy | null> {
  const { data, error } = await supabase
    .from('puppies')
    .select('*')
    .eq('id', puppyId)
    .single();

  if (error) return null;
  return data;
}

export async function uploadPuppyPhoto(userId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('puppy-photos')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('puppy-photos')
    .getPublicUrl(fileName);

  return publicUrl;
}

export async function fetchBreedProfiles(): Promise<BreedProfile[]> {
  const { data, error } = await supabase
    .from('breed_profiles')
    .select('*')
    .order('breed_name');

  if (error) {
    console.error('fetchBreedProfiles: error:', error);
    return [];
  }
  return data || [];
}

export function computeAgeDisplay(dateOfBirth: string | null, ageMonths?: number, ageWeeks?: number): string {
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth + 'T00:00:00');
    const now = new Date();
    const totalWeeks = Math.floor((now.getTime() - dob.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const months = Math.floor(totalWeeks / 4);
    const weeks = totalWeeks % 4;
    return `${months} months, ${weeks} weeks`;
  }
  if (ageMonths !== undefined && ageWeeks !== undefined) {
    return `${ageMonths} months, ${ageWeeks} weeks`;
  }
  return 'Unknown age';
}
