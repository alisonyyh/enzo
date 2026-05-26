-- breed_profiles: single source of truth for breed → characteristics (D68)
CREATE TABLE breed_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breed_name TEXT NOT NULL UNIQUE,
  breed_size TEXT NOT NULL CHECK (breed_size IN ('toy', 'small', 'medium', 'large', 'giant')),
  energy_level TEXT NOT NULL CHECK (energy_level IN ('high', 'moderate', 'low')),
  is_brachycephalic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE breed_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read breed profiles"
  ON breed_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed 30 breeds matching the onboarding dropdown
INSERT INTO breed_profiles (breed_name, breed_size, energy_level, is_brachycephalic) VALUES
  ('Mixed/Unknown',              'medium', 'moderate', false),
  ('Australian Shepherd',        'medium', 'high',     false),
  ('Beagle',                     'small',  'moderate', false),
  ('Bernese Mountain Dog',       'giant',  'moderate', false),
  ('Border Collie',              'medium', 'high',     false),
  ('Boston Terrier',             'small',  'moderate', true),
  ('Boxer',                      'large',  'moderate', true),
  ('Bulldog (English)',          'medium', 'low',      true),
  ('Cavalier King Charles',      'small',  'low',      true),
  ('Chihuahua',                  'toy',    'low',      false),
  ('Cocker Spaniel',             'small',  'moderate', false),
  ('Corgi (Pembroke Welsh)',     'small',  'moderate', false),
  ('Dachshund',                  'small',  'moderate', false),
  ('Dalmatian',                  'large',  'high',     false),
  ('Doberman Pinscher',          'large',  'high',     false),
  ('French Bulldog',             'small',  'low',      true),
  ('German Shepherd',            'large',  'high',     false),
  ('Golden Retriever',           'large',  'high',     false),
  ('Great Dane',                 'giant',  'low',      false),
  ('Havanese',                   'toy',    'moderate', false),
  ('Husky (Siberian)',           'large',  'high',     false),
  ('Labrador Retriever',         'large',  'high',     false),
  ('Maltese',                    'toy',    'low',      false),
  ('Miniature Schnauzer',        'small',  'moderate', false),
  ('Pomeranian',                 'toy',    'moderate', false),
  ('Poodle (Standard)',          'medium', 'moderate', false),
  ('Pug',                        'small',  'low',      true),
  ('Rottweiler',                 'large',  'moderate', false),
  ('Shih Tzu',                   'small',  'low',      true),
  ('Yorkshire Terrier',          'toy',    'moderate', false);
