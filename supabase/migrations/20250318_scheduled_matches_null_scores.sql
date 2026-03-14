-- Sæt home_score og away_score til NULL for scheduled kampe.
-- Bold returnerer 0-0 for ikke-startede kampe, hvilket forvirrer brugerne.
UPDATE matches SET home_score = NULL, away_score = NULL WHERE status = 'scheduled';
