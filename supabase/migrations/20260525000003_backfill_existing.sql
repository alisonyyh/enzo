-- Backfill existing puppies with DOB and breed fields

-- Synthesize DOB from stored age data: DOB ≈ created_at - total_weeks
UPDATE puppies
SET date_of_birth = (
  created_at::date - ((age_months * 4 + age_weeks) * INTERVAL '1 week')
)::date
WHERE date_of_birth IS NULL
  AND age_months IS NOT NULL;

-- Backfill breed fields via exact name match
UPDATE puppies p
SET
  breed_size = bp.breed_size,
  energy_level = bp.energy_level,
  is_brachycephalic = bp.is_brachycephalic
FROM breed_profiles bp
WHERE p.breed = bp.breed_name
  AND p.breed_size IS NULL;

-- Handle known name mismatches from old dropdown → new breed_profiles names
UPDATE puppies p
SET
  breed_size = bp.breed_size,
  energy_level = bp.energy_level,
  is_brachycephalic = bp.is_brachycephalic
FROM breed_profiles bp
WHERE p.breed_size IS NULL
  AND (
    (p.breed = 'Bulldog' AND bp.breed_name = 'Bulldog (English)')
    OR (p.breed = 'Poodle' AND bp.breed_name = 'Poodle (Standard)')
    OR (p.breed = 'Cavalier King Charles Spaniel' AND bp.breed_name = 'Cavalier King Charles')
    OR (p.breed = 'Siberian Husky' AND bp.breed_name = 'Husky (Siberian)')
    OR (p.breed = 'Pembroke Welsh Corgi' AND bp.breed_name = 'Corgi (Pembroke Welsh)')
  );

-- Default unmatched breeds to medium/moderate/false
UPDATE puppies
SET
  breed_size = COALESCE(breed_size, 'medium'),
  energy_level = COALESCE(energy_level, 'moderate'),
  is_brachycephalic = COALESCE(is_brachycephalic, false)
WHERE breed_size IS NULL;
