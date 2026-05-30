-- Add DOB and denormalized breed fields to puppies (D69, D72)
ALTER TABLE puppies
  ADD COLUMN date_of_birth DATE,
  ADD COLUMN breed_size TEXT,
  ADD COLUMN energy_level TEXT,
  ADD COLUMN is_brachycephalic BOOLEAN DEFAULT false;
