-- StoneSteps : reperes sonores et visuels du chrono
--
-- L'ecran de seance se pose a un metre, pas sous les yeux. Les reperes disent
-- ou en est le chrono sans qu'on ait a lever la tete — un son au depart, des
-- bips qui se resserrent a l'approche, un son a la bascule, et au besoin un
-- clignotement de l'ecran ou du flash.
--
-- Les reglages vivent sur le profil et non dans le navigateur : ce sont des
-- preferences de personne, pas d'appareil, et elles doivent suivre le compte.

alter table public.profiles
  -- Le son marche partout et ne demande aucune permission : actif par defaut.
  add column timer_sound boolean not null default true,
  -- Le clignotement non plus : actif par defaut.
  add column timer_blink boolean not null default true,
  -- Le flash demande l'acces a la camera. On ne reclame pas une permission
  -- sans que l'utilisateur l'ait voulue : inactif par defaut.
  add column timer_flash boolean not null default false,
  -- Fenetre d'annonce, en pourcentage de la duree visee. Un pourcentage et non
  -- un delai fixe : une serie de vingt secondes n'a pas besoin du meme preavis
  -- qu'une de deux minutes.
  add column timer_warning_percent integer not null default 15
    check (timer_warning_percent between 5 and 50);
