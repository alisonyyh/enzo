import { supabase } from '../supabase';
import type { Puppy, PuppyMembership } from '../database.types';

export interface CreatePuppyData {
  name: string;
  breed: string;
  age_months: number;
  age_weeks: number;
  weight_value: number | null;
  weight_unit: string;
  living_situation: string;
  photo_url?: string | null;
  questionnaire_data?: {
    workArrangement: string;
    wakeUpTime: string;
    bedTime: string;
  };
}

/**
 * Create a puppy and owner membership in one go
 */
export async function createPuppy(userId: string, data: CreatePuppyData): Promise<Puppy> {
  console.log('createPuppy: inserting puppy for user', userId);

  // Insert the puppy
  const { data: puppy, error: puppyError } = await supabase
    .from('puppies')
    .insert({
      name: data.name,
      breed: data.breed,
      age_months: data.age_months,
      age_weeks: data.age_weeks,
      weight_value: data.weight_value,
      weight_unit: data.weight_unit,
      living_situation: data.living_situation,
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

  // Create owner membership
  const { error: memberError } = await supabase
    .from('puppy_memberships')
    .insert({
      puppy_id: puppy.id,
      user_id: userId,
      role: 'owner',
    });

  if (memberError) {
    console.error('createPuppy: error creating membership:', memberError);
    throw memberError;
  }
  console.log('createPuppy: owner membership created');

  return puppy;
}

/**
 * Get all puppies the user has access to (as owner or caretaker)
 */
export async function getUserPuppies(userId: string): Promise<(PuppyMembership & { puppy: Puppy })[]> {
  const { data, error } = await supabase
    .from('puppy_memberships')
    .select('*, puppy:puppies(*)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) throw error;
  return (data || []) as any;
}

/**
 * Get a single puppy by ID (only if user has access)
 */
export async function getPuppy(puppyId: string): Promise<Puppy | null> {
  const { data, error } = await supabase
    .from('puppies')
    .select('*')
    .eq('id', puppyId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Upload a puppy photo to Supabase Storage
 */
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
