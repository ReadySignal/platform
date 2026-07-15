-- ReadySignal demo seed: run this entire script in the Supabase SQL Editor and click "Run".
-- It is safe to rerun. Inserts use NOT EXISTS checks and do not drop or alter tables.

BEGIN;

WITH demo_companies(name, industry, state, employee_count, is_target_account) AS (
  VALUES
    ('Vertiv', 'Electrical Equipment Manufacturing', 'OH', 27000, true),
    ('IronClad Motion Works', 'Industrial Machinery Manufacturing', 'OH', 4200, true),
    ('Sterling MedTech Fabrication', 'Medical Device Manufacturing', 'OH', 3100, true),
    ('Cascade Heavy Vehicles', 'Automotive Manufacturing', 'WA', 8600, true),
    ('Heartland Protein Equipment', 'Food Processing Manufacturing', 'KS', 2300, false),
    ('Carolina Process Controls', 'Process Instrumentation Manufacturing', 'NC', 1900, true),
    ('NorthStar Composite Labs', 'Advanced Materials Manufacturing', 'MN', 2800, true),
    ('Riverbend Packaging Solutions', 'Packaging Manufacturing', 'TX', 2500, false)
)
INSERT INTO companies (name, industry, state, employee_count, is_target_account)
SELECT dc.name, dc.industry, dc.state, dc.employee_count, dc.is_target_account
FROM demo_companies dc
WHERE NOT EXISTS (
  SELECT 1
  FROM companies c
  WHERE lower(c.name) = lower(dc.name)
);

WITH demo_contacts(
  company_name,
  first_name,
  last_name,
  title,
  location,
  phone,
  mobile,
  email,
  why_today,
  relevant_context,
  verified_contact,
  no_previous_outreach
) AS (
  VALUES
    ('Vertiv', 'John', 'Smith', 'Maintenance Manager', 'Anderson, SC', '(864) 555-0142', '(864) 555-0149', 'jsmith@vertiv.com', 'Recently promoted into a leadership role.', 'Mentioned reliability upgrades in prior conversations.', true, false),
    ('Vertiv', 'Elena', 'Ruiz', 'Reliability Engineer', 'Columbus, OH', '(614) 555-0131', '(614) 555-0132', 'elena.ruiz@vertiv-demo.example.test', 'Expansion planning is underway at the site.', 'Tracks vibration and downtime trends weekly.', true, true),
    ('Vertiv', 'Marcus', 'Hale', 'Plant Engineer', 'Delaware, OH', '(740) 555-0133', '(740) 555-0134', 'marcus.hale@vertiv-demo.example.test', 'New product line launch is affecting throughput.', 'Focused on reducing startup scrap during line changes.', true, true),

    ('IronClad Motion Works', 'Sarah', 'Jones', 'Reliability Engineer', 'Canton, OH', '(330) 555-0201', '(330) 555-0202', 'sarah.jones@ironclad-demo.example.test', 'Hiring activity suggests a larger maintenance mandate.', 'Owns reliability KPIs for rotating assets.', true, true),
    ('IronClad Motion Works', 'Owen', 'Hart', 'Plant Manager', 'Akron, OH', '(234) 555-0203', '(234) 555-0204', 'owen.hart@ironclad-demo.example.test', 'Capital investment approval was announced this quarter.', 'Leading a multi-line productivity improvement program.', true, false),
    ('IronClad Motion Works', 'Priya', 'Nair', 'Continuous Improvement Manager', 'Youngstown, OH', '(330) 555-0205', '(330) 555-0206', 'priya.nair@ironclad-demo.example.test', 'Leadership change opened a new process excellence charter.', 'Runs kaizen events tied to uptime and OEE.', true, true),

    ('Sterling MedTech Fabrication', 'Michael', 'Davis', 'Plant Engineer', 'Mentor, OH', '(440) 555-0211', '(440) 555-0212', 'michael.davis@sterling-demo.example.test', 'Expansion of clean-room capacity is on the roadmap.', 'Balancing validation timelines with production uptime.', true, true),
    ('Sterling MedTech Fabrication', 'Talia', 'Brooks', 'Operations Manager', 'Cleveland, OH', '(216) 555-0213', '(216) 555-0214', 'talia.brooks@sterling-demo.example.test', 'Promotion created urgency around first-90-day wins.', 'Tracking OTIF pressure from downstream hospitals.', true, false),
    ('Sterling MedTech Fabrication', 'Grant', 'Keller', 'Maintenance Manager', 'Toledo, OH', '(419) 555-0215', '(419) 555-0216', 'grant.keller@sterling-demo.example.test', 'No previous outreach and strong title fit.', 'Needs better preventive maintenance completion rates.', true, true),

    ('Cascade Heavy Vehicles', 'Alicia', 'Chen', 'Operations Manager', 'Mount Vernon, WA', '(360) 555-0221', '(360) 555-0222', 'alicia.chen@cascade-demo.example.test', 'Expansion program includes a new body assembly cell.', 'Cross-functional owner for shift-level KPI reviews.', true, false),
    ('Cascade Heavy Vehicles', 'Noah', 'Patel', 'Plant Manager', 'Everett, WA', '(425) 555-0223', '(425) 555-0224', 'noah.patel@cascade-demo.example.test', 'Capital project funding was confirmed by leadership.', 'Driving takt-time improvements on two final lines.', true, false),
    ('Cascade Heavy Vehicles', 'Erin', 'Cole', 'Continuous Improvement Manager', 'Seattle, WA', '(206) 555-0225', '(206) 555-0226', 'erin.cole@cascade-demo.example.test', 'Recent hiring indicates expanded CI scope.', 'Leads standardized work and line balancing initiatives.', true, true),

    ('Heartland Protein Equipment', 'Derek', 'Patel', 'Operations Manager', 'Wichita, KS', '(316) 555-0231', '(316) 555-0232', 'derek.patel@heartland-demo.example.test', 'Industry news is driving a tighter compliance timeline.', 'Focused on washdown reliability and sanitation uptime.', true, false),
    ('Heartland Protein Equipment', 'Nina', 'Rivera', 'Maintenance Manager', 'Hutchinson, KS', '(620) 555-0233', '(620) 555-0234', 'nina.rivera@heartland-demo.example.test', 'Leadership transition shifted maintenance ownership.', 'Evaluating backlog reduction and PM quality metrics.', true, true),
    ('Heartland Protein Equipment', 'Colin', 'West', 'Reliability Engineer', 'Salina, KS', '(785) 555-0235', '(785) 555-0236', 'colin.west@heartland-demo.example.test', 'No previous outreach and active reliability initiatives.', 'Monitoring compressor and conveyor failure patterns.', true, true),

    ('Carolina Process Controls', 'Riley', 'Chen', 'Plant Manager', 'Charlotte, NC', '(704) 555-0241', '(704) 555-0242', 'riley.chen@carolina-demo.example.test', 'New product line launch is increasing process complexity.', 'Needs faster root-cause cycles after line stops.', true, false),
    ('Carolina Process Controls', 'Isaac', 'Moore', 'Reliability Engineer', 'Greensboro, NC', '(336) 555-0243', '(336) 555-0244', 'isaac.moore@carolina-demo.example.test', 'Capital-investment approvals include instrumentation upgrades.', 'Runs PdM program for pumps and controls assets.', true, true),
    ('Carolina Process Controls', 'Dana', 'Kim', 'Continuous Improvement Manager', 'Raleigh, NC', '(919) 555-0245', '(919) 555-0246', 'dana.kim@carolina-demo.example.test', 'Promotion expanded responsibility across two plants.', 'Owns CI portfolio and savings validation.', true, true),

    ('NorthStar Composite Labs', 'Marcus', 'Lee', 'Plant Engineer', 'St. Paul, MN', '(651) 555-0251', '(651) 555-0252', 'marcus.lee@northstar-demo.example.test', 'Expansion into aerospace-grade composites is active.', 'Working to stabilize cure-cycle variability.', true, false),
    ('NorthStar Composite Labs', 'Tessa', 'Brooks', 'Operations Manager', 'Duluth, MN', '(218) 555-0253', '(218) 555-0254', 'tessa.brooks@northstar-demo.example.test', 'Previous success with pilot reliability work is documented.', 'Looking to scale pilot results to all shifts.', true, false),
    ('NorthStar Composite Labs', 'Julian', 'Park', 'Maintenance Manager', 'Rochester, MN', '(507) 555-0255', '(507) 555-0256', 'julian.park@northstar-demo.example.test', 'Hiring indicates dedicated maintenance expansion.', 'Targeting fewer unplanned autoclave interruptions.', true, true),

    ('Riverbend Packaging Solutions', 'Maya', 'Ortiz', 'Plant Manager', 'Fort Worth, TX', '(817) 555-0261', '(817) 555-0262', 'maya.ortiz@riverbend-demo.example.test', 'Leadership change aligns with operational reset goals.', 'Focused on reducing changeover losses.', true, false),
    ('Riverbend Packaging Solutions', 'Logan', 'Price', 'Reliability Engineer', 'Arlington, TX', '(682) 555-0263', '(682) 555-0264', 'logan.price@riverbend-demo.example.test', 'No previous outreach and active uptime mandate.', 'Tracking recurring faults on fillers and sealers.', true, true),
    ('Riverbend Packaging Solutions', 'Keira', 'Sutton', 'Continuous Improvement Manager', 'Dallas, TX', '(214) 555-0265', '(214) 555-0266', 'keira.sutton@riverbend-demo.example.test', 'Capital investment supports throughput and quality goals.', 'Leads KPI governance for scrap and downtime.', true, true)
)
INSERT INTO contacts (
  company_id,
  first_name,
  last_name,
  title,
  location,
  phone,
  mobile,
  email,
  signal_id,
  why_today,
  relevant_context,
  verified_contact,
  no_previous_outreach
)
SELECT
  c.id,
  dc.first_name,
  dc.last_name,
  dc.title,
  dc.location,
  dc.phone,
  dc.mobile,
  dc.email,
  NULL,
  dc.why_today,
  dc.relevant_context,
  dc.verified_contact,
  dc.no_previous_outreach
FROM demo_contacts dc
JOIN companies c
  ON lower(c.name) = lower(dc.company_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM contacts ct
  WHERE lower(ct.email) = lower(dc.email)
);

WITH demo_signals(contact_email, signal_type, headline, details, source_url, days_ago, score_points, is_active) AS (
  VALUES
    ('jsmith@vertiv.com', 'promotion', 'Promoted to Maintenance Manager', 'Transitioned into maintenance leadership this quarter.', 'https://demo.readysignal.local/vertiv/promotion', 7, 92, true),
    ('jsmith@vertiv.com', 'capital-investment', 'Reliability budget approved for Q3', 'Site approved spend for predictive maintenance tooling.', 'https://demo.readysignal.local/vertiv/capex', 14, 86, true),
    ('jsmith@vertiv.com', 'previous-success', 'Prior pilot reduced downtime by 11%', 'Ops leadership referenced previous implementation success.', 'https://demo.readysignal.local/vertiv/success', 32, 74, true),

    ('elena.ruiz@vertiv-demo.example.test', 'expansion', 'Additional assembly capacity planned', 'Site expansion charter includes reliability planning.', 'https://demo.readysignal.local/vertiv/expansion', 6, 88, true),
    ('elena.ruiz@vertiv-demo.example.test', 'hiring', 'Reliability technician requisition opened', 'New technician role posted to support uptime goals.', 'https://demo.readysignal.local/vertiv/hiring', 11, 72, true),

    ('marcus.hale@vertiv-demo.example.test', 'new-product-line', 'New modular power line entering pilot', 'Pilot line startup puts pressure on engineering support.', 'https://demo.readysignal.local/vertiv/new-line', 5, 84, true),
    ('marcus.hale@vertiv-demo.example.test', 'no-previous-outreach', 'No prior outreach logged for contact', 'Contact has not been worked by outbound motions yet.', 'https://demo.readysignal.local/vertiv/new-contact', 30, 66, true),

    ('sarah.jones@ironclad-demo.example.test', 'hiring', 'Reliability team hiring for second shift', 'Posting indicates expanded coverage and process maturity.', 'https://demo.readysignal.local/ironclad/hiring', 8, 80, true),
    ('sarah.jones@ironclad-demo.example.test', 'industry-news', 'Supplier lead-time volatility impacting throughput', 'Industry updates cite increased maintenance planning urgency.', 'https://demo.readysignal.local/ironclad/news', 16, 68, true),

    ('owen.hart@ironclad-demo.example.test', 'capital-investment', 'Plant approved modernization budget', 'Funding allocated for line reliability and controls upgrades.', 'https://demo.readysignal.local/ironclad/capex', 4, 90, true),
    ('owen.hart@ironclad-demo.example.test', 'leadership-change', 'New COO announced operations reset', 'Executive shift typically triggers vendor evaluations.', 'https://demo.readysignal.local/ironclad/leadership', 19, 76, true),

    ('priya.nair@ironclad-demo.example.test', 'leadership-change', 'CI program moved under operations excellence office', 'Organizational update expanded mandate across facilities.', 'https://demo.readysignal.local/ironclad/ci-change', 9, 82, true),
    ('priya.nair@ironclad-demo.example.test', 'previous-success', 'Recent kaizen event improved OEE by 6 points', 'Demonstrated openness to process optimization partners.', 'https://demo.readysignal.local/ironclad/oee', 21, 70, true),

    ('michael.davis@sterling-demo.example.test', 'expansion', 'Clean-room buildout phase two approved', 'Expansion plan requires tighter reliability controls.', 'https://demo.readysignal.local/sterling/expansion', 6, 87, true),
    ('michael.davis@sterling-demo.example.test', 'capital-investment', 'Validation equipment investment announced', 'New equipment adds commissioning and uptime complexity.', 'https://demo.readysignal.local/sterling/capex', 15, 78, true),

    ('talia.brooks@sterling-demo.example.test', 'promotion', 'Promoted to Operations Manager', 'Recently took ownership of plant-level execution metrics.', 'https://demo.readysignal.local/sterling/promotion', 10, 85, true),
    ('talia.brooks@sterling-demo.example.test', 'industry-news', 'Hospital demand forecasts revised upward', 'Demand signals likely increase production pressure.', 'https://demo.readysignal.local/sterling/news', 18, 67, true),

    ('grant.keller@sterling-demo.example.test', 'no-previous-outreach', 'No prior outreach on record', 'Fresh contact with high role relevance.', 'https://demo.readysignal.local/sterling/new-contact', 27, 69, true),
    ('grant.keller@sterling-demo.example.test', 'hiring', 'Maintenance planner opening posted', 'Maintenance planning headcount is being added.', 'https://demo.readysignal.local/sterling/hiring', 12, 73, true),

    ('alicia.chen@cascade-demo.example.test', 'expansion', 'New body assembly cell greenlit', 'Capacity growth initiative increases operational complexity.', 'https://demo.readysignal.local/cascade/expansion', 5, 89, true),
    ('alicia.chen@cascade-demo.example.test', 'new-product-line', 'Electric fleet chassis entering launch', 'Launch schedule adds risk to uptime targets.', 'https://demo.readysignal.local/cascade/new-line', 13, 81, true),

    ('noah.patel@cascade-demo.example.test', 'capital-investment', 'Automation budget approved for final assembly', 'Approved project includes controls and reliability work.', 'https://demo.readysignal.local/cascade/capex', 4, 91, true),
    ('noah.patel@cascade-demo.example.test', 'leadership-change', 'Regional operations leadership reassigned', 'Leadership transition often reopens process priorities.', 'https://demo.readysignal.local/cascade/leadership', 20, 75, true),

    ('erin.cole@cascade-demo.example.test', 'hiring', 'CI specialist req opened', 'Hiring indicates broader optimization mandate.', 'https://demo.readysignal.local/cascade/hiring', 8, 77, true),
    ('erin.cole@cascade-demo.example.test', 'previous-success', 'Recent SMED initiative cut changeover time', 'Documented CI success suggests openness to new tools.', 'https://demo.readysignal.local/cascade/smed', 23, 71, true),

    ('derek.patel@heartland-demo.example.test', 'industry-news', 'Food safety guidance update released', 'Compliance updates increase reliability process focus.', 'https://demo.readysignal.local/heartland/news', 9, 72, true),
    ('derek.patel@heartland-demo.example.test', 'expansion', 'Protein line throughput expansion announced', 'Site preparing for higher run-rate targets.', 'https://demo.readysignal.local/heartland/expansion', 14, 79, true),

    ('nina.rivera@heartland-demo.example.test', 'leadership-change', 'Maintenance ownership moved under new ops lead', 'Shift in reporting line can trigger system updates.', 'https://demo.readysignal.local/heartland/leadership', 11, 78, true),
    ('nina.rivera@heartland-demo.example.test', 'capital-investment', 'CMMS enhancement funding approved', 'Approved project supports maintenance workflow maturity.', 'https://demo.readysignal.local/heartland/capex', 22, 70, true),

    ('colin.west@heartland-demo.example.test', 'no-previous-outreach', 'No previous outreach to this reliability engineer', 'Untouched contact with strong technical fit.', 'https://demo.readysignal.local/heartland/new-contact', 25, 68, true),
    ('colin.west@heartland-demo.example.test', 'hiring', 'Reliability analyst role posted', 'Team expansion suggests active reliability roadmap.', 'https://demo.readysignal.local/heartland/hiring', 7, 76, true),

    ('riley.chen@carolina-demo.example.test', 'new-product-line', 'New controls platform SKU launch scheduled', 'Launch introduces commissioning and process risk.', 'https://demo.readysignal.local/carolina/new-line', 6, 86, true),
    ('riley.chen@carolina-demo.example.test', 'leadership-change', 'Operations VP announced process excellence focus', 'Top-down emphasis often accelerates buying cycles.', 'https://demo.readysignal.local/carolina/leadership', 17, 74, true),

    ('isaac.moore@carolina-demo.example.test', 'capital-investment', 'Instrumentation modernization approved', 'Project includes reliability and controls upgrades.', 'https://demo.readysignal.local/carolina/capex', 5, 88, true),
    ('isaac.moore@carolina-demo.example.test', 'industry-news', 'Semiconductor component constraints easing', 'Market shift may accelerate deferred projects.', 'https://demo.readysignal.local/carolina/news', 26, 65, true),

    ('dana.kim@carolina-demo.example.test', 'promotion', 'Promoted to Continuous Improvement Manager', 'Expanded scope across both plants.', 'https://demo.readysignal.local/carolina/promotion', 8, 83, true),
    ('dana.kim@carolina-demo.example.test', 'previous-success', 'Recent CI wave delivered measurable scrap reduction', 'Evidence of successful adoption for operational tools.', 'https://demo.readysignal.local/carolina/success', 20, 72, true),

    ('marcus.lee@northstar-demo.example.test', 'expansion', 'Aerospace composite line scaling approved', 'Expansion likely increases reliability complexity.', 'https://demo.readysignal.local/northstar/expansion', 7, 87, true),
    ('marcus.lee@northstar-demo.example.test', 'new-product-line', 'High-temp composite program entering pilot', 'Pilot demand creates urgency around stable operations.', 'https://demo.readysignal.local/northstar/new-line', 15, 79, true),

    ('tessa.brooks@northstar-demo.example.test', 'previous-success', 'Pilot reliability sprint reduced defects by 9%', 'Demonstrated process adoption and measurable results.', 'https://demo.readysignal.local/northstar/success', 6, 82, true),
    ('tessa.brooks@northstar-demo.example.test', 'industry-news', 'Aerospace backlog forecasts revised upward', 'Higher demand can strain operating cadence.', 'https://demo.readysignal.local/northstar/news', 21, 69, true),

    ('julian.park@northstar-demo.example.test', 'hiring', 'Maintenance planner hiring posted', 'Headcount growth suggests proactive maintenance push.', 'https://demo.readysignal.local/northstar/hiring', 9, 77, true),
    ('julian.park@northstar-demo.example.test', 'no-previous-outreach', 'No outreach has been logged for this contact', 'Fresh contact aligned to maintenance ownership.', 'https://demo.readysignal.local/northstar/new-contact', 29, 67, true),

    ('maya.ortiz@riverbend-demo.example.test', 'leadership-change', 'New plant leadership charter announced', 'Leadership refresh emphasizes throughput and uptime.', 'https://demo.readysignal.local/riverbend/leadership', 10, 81, true),
    ('maya.ortiz@riverbend-demo.example.test', 'expansion', 'Packaging line 4 capacity expansion approved', 'Expansion initiative raises reliability stakes.', 'https://demo.readysignal.local/riverbend/expansion', 18, 75, true),

    ('logan.price@riverbend-demo.example.test', 'no-previous-outreach', 'No previous outreach to reliability engineer', 'Opportunity for first-touch conversation.', 'https://demo.readysignal.local/riverbend/new-contact', 24, 68, true),
    ('logan.price@riverbend-demo.example.test', 'capital-investment', 'Filler modernization project funded', 'Budget includes controls and maintenance readiness.', 'https://demo.readysignal.local/riverbend/capex', 8, 84, true),

    ('keira.sutton@riverbend-demo.example.test', 'capital-investment', 'Throughput optimization funding approved', 'Approved initiative ties directly to CI objectives.', 'https://demo.readysignal.local/riverbend/capex-2', 5, 86, true),
    ('keira.sutton@riverbend-demo.example.test', 'hiring', 'CI analyst role posted for second shift', 'Hiring aligns with broader continuous improvement agenda.', 'https://demo.readysignal.local/riverbend/hiring', 13, 73, true)
)
INSERT INTO signals (
  company_id,
  contact_id,
  signal_type,
  headline,
  details,
  source_url,
  occurred_at,
  score_points,
  is_active
)
SELECT
  c.company_id,
  c.id,
  ds.signal_type,
  ds.headline,
  ds.details,
  ds.source_url,
  now() - ((ds.days_ago::text || ' days')::interval),
  ds.score_points,
  ds.is_active
FROM demo_signals ds
JOIN contacts c
  ON lower(c.email) = lower(ds.contact_email)
WHERE NOT EXISTS (
  SELECT 1
  FROM signals s
  WHERE s.contact_id = c.id
    AND lower(s.signal_type) = lower(ds.signal_type)
    AND lower(s.headline) = lower(ds.headline)
);

COMMIT;
