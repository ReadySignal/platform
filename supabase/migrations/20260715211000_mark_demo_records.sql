-- Product Iteration 27.1: distinguish demo seed records from real imported records.

alter table public.companies
  add column if not exists is_demo boolean not null default false;

alter table public.contacts
  add column if not exists is_demo boolean not null default false;

alter table public.signals
  add column if not exists is_demo boolean not null default false;

update public.companies
set is_demo = true
where lower(name) in (
  'vertiv',
  'ironclad motion works',
  'sterling medtech fabrication',
  'cascade heavy vehicles',
  'heartland protein equipment',
  'carolina process controls',
  'northstar composite labs',
  'riverbend packaging solutions'
);

update public.contacts
set is_demo = true
where lower(email) in (
  'jsmith@vertiv.com',
  'elena.ruiz@vertiv-demo.example.test',
  'marcus.hale@vertiv-demo.example.test',
  'sarah.jones@ironclad-demo.example.test',
  'owen.hart@ironclad-demo.example.test',
  'priya.nair@ironclad-demo.example.test',
  'michael.davis@sterling-demo.example.test',
  'talia.brooks@sterling-demo.example.test',
  'grant.keller@sterling-demo.example.test',
  'alicia.chen@cascade-demo.example.test',
  'noah.patel@cascade-demo.example.test',
  'erin.cole@cascade-demo.example.test',
  'derek.patel@heartland-demo.example.test',
  'nina.rivera@heartland-demo.example.test',
  'colin.west@heartland-demo.example.test',
  'riley.chen@carolina-demo.example.test',
  'isaac.moore@carolina-demo.example.test',
  'dana.kim@carolina-demo.example.test',
  'marcus.lee@northstar-demo.example.test',
  'tessa.brooks@northstar-demo.example.test',
  'julian.park@northstar-demo.example.test',
  'maya.ortiz@riverbend-demo.example.test',
  'logan.price@riverbend-demo.example.test',
  'keira.sutton@riverbend-demo.example.test'
);

update public.signals
set is_demo = true
where source_url ilike 'https://demo.readysignal.local/%';
