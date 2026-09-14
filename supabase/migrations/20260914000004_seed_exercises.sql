-- StoneSteps : catalogue d'exercices integre
--
-- Reprend la bibliotheque de la maquette (design/Callisthenics App.dc.html),
-- dans le meme ordre et les memes groupes. owner_id reste null : ce sont les
-- exercices integres, visibles de tous. Un utilisateur reste libre d'ajouter
-- les siens, qui portent alors son owner_id.
--
-- Ecart assume a la convention "SQL en ASCII" : les accents sont conserves
-- dans les noms, et uniquement la. Ce sont des chaines affichees telles quelles
-- dans une interface francaise, et le handoff demande de reprendre la liste de
-- la maquette. Commentaires et identifiants restent en ASCII.

insert into public.exercises (name, muscle_group)
values
  -- Poussee
  ('Pompes',                 'push'),
  ('Pompes inclinées',       'push'),
  ('Pompes sautées',         'push'),
  ('Dips',                   'push'),
  ('Pompes piquées',         'push'),

  -- Tirage
  ('Tractions',              'pull'),
  ('Tractions supination',   'pull'),
  ('Rowing australien',      'pull'),
  ('Tractions négatives',    'pull'),

  -- Jambes
  ('Squats',                 'legs'),
  ('Squats bulgares',        'legs'),
  ('Fentes sautées',         'legs'),
  ('Nordic curl',            'legs'),
  ('Mollets debout',         'legs'),

  -- Gainage et skills
  ('Planche (gainage)',      'core'),
  ('Gainage L-sit',          'core'),
  ('Relevés de jambes',      'core'),
  ('Poirier freestanding',   'core'),
  ('Hollow body',            'core');
