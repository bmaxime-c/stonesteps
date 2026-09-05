-- StoneSteps : catalogue d'exercices integre
--
-- Couvre les progressions evoquees dans la grille de reference (10 niveaux) :
-- une meme famille decline plusieurs variantes, de la plus accessible a la
-- plus technique. Un membre reste libre d'ajouter ses propres exercices.

insert into public.exercises (name, category, is_builtin)
select v.name, v.category, true
from (values
  -- Poussee
  ('Pompes murales',                'push'),
  ('Pompes inclinees',              'push'),
  ('Pompes classiques',             'push'),
  ('Pompes pieds sureleves',        'push'),
  ('Pompes diamant',                'push'),
  ('Pompes archer',                 'push'),
  ('Pompes claquees',               'push'),
  ('Pompes a un bras',              'push'),

  -- Traction
  ('Tractions australiennes',       'pull'),
  ('Tractions assistees',           'pull'),
  ('Tractions strictes',            'pull'),
  ('Tractions controlees',          'pull'),
  ('Tractions explosives',          'pull'),
  ('Tractions lestees',             'pull'),
  ('Muscle-up negatif',             'pull'),
  ('Muscle-up',                     'pull'),

  -- Dips
  ('Dips sur banc',                 'push'),
  ('Dips sur barres',               'push'),
  ('Dips lestes',                   'push'),

  -- Jambes
  ('Squats classiques',             'legs'),
  ('Squats pieds sureleves',        'legs'),
  ('Fentes',                        'legs'),
  ('Squats bulgares',               'legs'),
  ('Squats sautes',                 'legs'),
  ('Pistol squat assiste',          'legs'),
  ('Pistol squat',                  'legs'),

  -- Gainage et statiques
  ('Planche (gainage)',             'core'),
  ('Planche laterale',              'core'),
  ('Planche avec lever de jambe',   'core'),
  ('Planche lestee',                'core'),
  ('Hollow body hold',              'core'),
  ('Releve de jambes suspendu',     'core'),
  ('L-sit',                         'core'),
  ('Handstand contre mur',          'core'),
  ('Dragon flag',                   'core')
) as v (name, category)
where not exists (
  select 1
  from public.exercises e
  where e.is_builtin
    and lower(e.name) = lower(v.name)
);
