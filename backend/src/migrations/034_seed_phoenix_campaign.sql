-- Migration: Seed Phoenix Division Campaign
-- Description: Initial data for Phoenix Division 6-week sales campaign

-- Get user IDs for Brian Smith, Cory Willey, and Brian Wohlers
DO $$
DECLARE
  brian_smith_id INTEGER;
  cory_willey_id INTEGER;
  brian_wohlers_id INTEGER;
  new_campaign_id INTEGER;
BEGIN
  -- Find the users (they should exist in employees/users)
  SELECT id INTO brian_smith_id FROM users WHERE email = 'jsmith@tweetgarot.com';
  -- Note: Cory Willey and Brian Wohlers need to be in the database
  -- For now, we'll use existing users as proxies
  SELECT id INTO cory_willey_id FROM users WHERE email = 'sgarcia@tweetgarot.com';
  SELECT id INTO brian_wohlers_id FROM users WHERE email = 'bwilson@tweetgarot.com';

  -- Create the Phoenix Division campaign
  INSERT INTO campaigns (name, description, start_date, end_date, status, owner_id, total_targets)
  VALUES (
    'Phoenix Division - 6 Week Campaign',
    'Target 40 high-value manufacturing and food processing companies in the Phoenix area. Focus on A-tier prospects (score 80+) in weeks 1-3, B-tier in weeks 4-6.',
    '2025-02-02',
    '2025-03-15',
    'active',
    brian_smith_id,
    40
  )
  RETURNING id INTO new_campaign_id;

  -- Create campaign weeks
  INSERT INTO campaign_weeks (campaign_id, week_number, start_date, end_date, label) VALUES
    (new_campaign_id, 1, '2025-02-02', '2025-02-08', 'Feb 2 - 8'),
    (new_campaign_id, 2, '2025-02-09', '2025-02-15', 'Feb 9 - 15'),
    (new_campaign_id, 3, '2025-02-16', '2025-02-22', 'Feb 16 - 22'),
    (new_campaign_id, 4, '2025-02-23', '2025-03-01', 'Feb 23 - Mar 1'),
    (new_campaign_id, 5, '2025-03-02', '2025-03-08', 'Mar 2 - 8'),
    (new_campaign_id, 6, '2025-03-09', '2025-03-15', 'Mar 9 - 15');

  -- Add team members
  INSERT INTO campaign_team_members (campaign_id, user_id, role, target_count) VALUES
    (new_campaign_id, brian_smith_id, 'owner', 15),
    (new_campaign_id, cory_willey_id, 'member', 13),
    (new_campaign_id, brian_wohlers_id, 'member', 12);

  -- Insert campaign companies (A-Tier)
  INSERT INTO campaign_companies (campaign_id, name, sector, address, phone, tier, score, assigned_to_id, target_week, status, next_action) VALUES
    (new_campaign_id, 'SK Food Group', 'Food Processing', '790 S. 75th Ave, Tolleson, AZ 85353', '(206) 935-8100', 'A', 90, brian_smith_id, 1, 'prospect', 'none'),
    (new_campaign_id, 'United Dairymen of Arizona', 'Dairy Processing', '2008 S. Hardy Dr, Tempe, AZ 85282', '(480) 966-7211', 'A', 90, brian_smith_id, 2, 'prospect', 'none'),
    (new_campaign_id, 'Microchip Technology', 'Semiconductor', '2355 W. Chandler Blvd, Chandler, AZ 85224', '(480) 792-7200', 'A', 88, brian_smith_id, 1, 'prospect', 'none'),
    (new_campaign_id, 'Shamrock Foods', 'Dairy/Food', '2540 N. 29th Ave, Phoenix, AZ 85009', '(602) 233-6400', 'A', 88, brian_smith_id, 2, 'prospect', 'none'),
    (new_campaign_id, 'Northrop Grumman SMF', 'Satellite Mfg', '1575 N. Voyager Ave, Gilbert, AZ 85234', '(480) 425-6000', 'A', 88, cory_willey_id, 1, 'prospect', 'none'),
    (new_campaign_id, 'Footprint LLC', 'Sustainable Packaging', '250 E. Germann Rd, Gilbert, AZ 85297', '(480) 456-9000', 'A', 87, brian_wohlers_id, 1, 'prospect', 'none'),
    (new_campaign_id, 'Swire Coca-Cola', 'Beverage Bottling', '1850 E. University Dr, Tempe, AZ 85281', '(480) 775-7000', 'A', 86, cory_willey_id, 2, 'prospect', 'none'),
    (new_campaign_id, 'Stryker Sustainability', 'Medical Device', '2681 S. Alma School Rd, Chandler, AZ 85286', '(480) 792-1450', 'A', 85, brian_wohlers_id, 1, 'prospect', 'none'),
    (new_campaign_id, 'Boeing Mesa', 'Aerospace Mfg', '5000 E. McDowell Rd, Mesa, AZ 85215', '(480) 891-3000', 'A', 85, cory_willey_id, 1, 'prospect', 'none'),
    (new_campaign_id, 'Benchmark Electronics', 'Electronics', '3201 S. 38th St, Tempe, AZ 85282', '(480) 634-5700', 'A', 85, brian_wohlers_id, 1, 'prospect', 'none'),
    (new_campaign_id, 'Honeywell Aerospace HQ', 'Aerospace', '1944 E. Sky Harbor Circle, Phoenix, AZ 85034', '(602) 365-3099', 'A', 84, brian_smith_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'SanTan Brewing', 'Beverage Production', '495 E. Warner Rd, Chandler, AZ 85225', '(480) 534-7041', 'A', 82, cory_willey_id, 2, 'prospect', 'none'),
    (new_campaign_id, 'XNRGY Climate Solutions', 'HVAC Mfg', '8501 E. Raintree Dr, Mesa, AZ 85212', '(480) 830-0800', 'A', 82, cory_willey_id, 2, 'prospect', 'none'),
    (new_campaign_id, 'Meyer Burger', 'Solar Mfg', '16701 W. Commerce Dr, Goodyear, AZ 85338', '(623) 386-7700', 'A', 82, brian_wohlers_id, 2, 'prospect', 'none'),
    (new_campaign_id, 'Amkor Technology', 'Semiconductor', '2045 E. Innovation Circle, Tempe, AZ 85284', '(480) 821-5000', 'A', 82, brian_wohlers_id, 2, 'prospect', 'none'),
    (new_campaign_id, 'First Solar', 'Solar Mfg', '350 W. Washington St #600, Tempe, AZ 85281', '(602) 414-9300', 'A', 80, cory_willey_id, 2, 'prospect', 'none'),
    (new_campaign_id, 'Precision Aerospace', 'Aerospace', '4020 E. Cotton Center Blvd, Phoenix, AZ 85040', '(602) 243-1500', 'A', 80, cory_willey_id, 2, 'prospect', 'none');

  -- Insert campaign companies (B-Tier)
  INSERT INTO campaign_companies (campaign_id, name, sector, address, phone, tier, score, assigned_to_id, target_week, status, next_action) VALUES
    (new_campaign_id, 'Capistrano''s Bakery', 'Bakery Mfg', '2635 S. 24th St, Phoenix, AZ 85034', '(480) 968-0468', 'B', 78, cory_willey_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'Honeywell (Tempe)', 'Aerospace', '1300 W. Warner Rd, Tempe, AZ 85284', '(480) 592-3000', 'B', 78, brian_wohlers_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'Edwards Vacuum', 'Semiconductor Equip', '301 S. Roosevelt Ave, Chandler, AZ 85226', '(480) 961-4000', 'B', 78, brian_wohlers_id, 2, 'prospect', 'none'),
    (new_campaign_id, 'AZ Wilderness Brewing', 'Brewery', '721 N. Arizona Ave, Gilbert, AZ 85233', '(480) 284-9863', 'B', 77, cory_willey_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'Liberty Paper Products', 'Paper Products', '2701 E. Chambers St, Phoenix, AZ 85040', '(602) 276-2891', 'B', 76, brian_wohlers_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'JX Nippon Mining', 'Electronics Materials', '1235 S. Power Rd, Mesa, AZ 85206', '(480) 832-9950', 'B', 76, brian_wohlers_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'Arizona Foods Group', 'Food Mfg', '2111 W. Camelback Rd, Phoenix, AZ 85015', '(602) 242-0808', 'B', 76, cory_willey_id, 4, 'prospect', 'none'),
    (new_campaign_id, 'General Dynamics C4', 'Defense', '8220 E. Roosevelt St, Scottsdale, AZ 85257', '(480) 441-4000', 'B', 75, brian_wohlers_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'Phoenix Defense', 'Aerospace', '1455 N. Greenfield Rd, Gilbert, AZ 85234', '(480) 503-7600', 'B', 75, cory_willey_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'Cytec Engineered', 'Composites', '1300 E. University Dr, Tempe, AZ 85281', '(480) 730-2000', 'B', 75, cory_willey_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'Stern Produce', 'Food Distribution', '2640 S. 19th Ave, Phoenix, AZ 85009', '(602) 253-3328', 'B', 75, cory_willey_id, 4, 'prospect', 'none'),
    (new_campaign_id, 'Lineage Logistics', 'Cold Storage', '17651 W. Yuma Rd, Waddell, AZ 85355', '(623) 535-8600', 'B', 74, brian_wohlers_id, 4, 'prospect', 'none'),
    (new_campaign_id, 'Romac Industries', 'Pipeline Mfg', '1501 N. Litchfield Rd, Goodyear, AZ 85338', '(623) 932-3777', 'B', 74, cory_willey_id, 4, 'prospect', 'none'),
    (new_campaign_id, 'Modern Industries', 'Aerospace', '4302 E. Elwood St, Phoenix, AZ 85040', '(602) 268-7773', 'B', 74, brian_wohlers_id, 4, 'prospect', 'none'),
    (new_campaign_id, 'Innovia Manufacturing', 'Metal Fabrication', '4330 W. Chandler Blvd, Chandler, AZ 85226', '(480) 785-4400', 'B', 74, cory_willey_id, 3, 'prospect', 'none'),
    (new_campaign_id, 'Danzeisen Dairy', 'Dairy Processing', '3625 W. Dobbins Rd, Laveen, AZ 85339', '(602) 237-3565', 'B', 73, cory_willey_id, 4, 'prospect', 'none'),
    (new_campaign_id, 'Verigon Electronics', 'Contract Mfg', '2133 W. University Dr, Tempe, AZ 85281', '(480) 921-0600', 'B', 72, brian_wohlers_id, 4, 'prospect', 'none'),
    (new_campaign_id, 'GTI Energy', 'Manufacturing', '16920 W. Roosevelt St, Goodyear, AZ 85338', '(623) 932-0600', 'B', 72, cory_willey_id, 5, 'prospect', 'none'),
    (new_campaign_id, 'Arcadia Cold Storage', 'Cold Storage', '14450 W. Olive Ave, El Mirage, AZ 85335', '(623) 935-3400', 'B', 72, cory_willey_id, 4, 'prospect', 'none'),
    (new_campaign_id, 'TurbineAero', 'Aerospace MRO', '1651 E. Northrop Blvd, Chandler, AZ 85286', '(480) 659-7800', 'B', 72, brian_wohlers_id, 5, 'prospect', 'none'),
    (new_campaign_id, 'Huss Brewing', 'Brewery', '100 E. Camelback Rd, Tempe, AZ 85281', '(480) 264-4844', 'B', 72, brian_wohlers_id, 5, 'prospect', 'none'),
    (new_campaign_id, 'La Canasta Mexican', 'Food Mfg', '3715 W. McDowell Rd, Phoenix, AZ 85009', '(602) 269-9210', 'B', 71, cory_willey_id, 5, 'prospect', 'none'),
    (new_campaign_id, 'Sub-Zero Group', 'Appliance Mfg', '16651 W. Yuma Rd, Goodyear, AZ 85338', '(623) 935-6800', 'B', 70, brian_wohlers_id, 5, 'prospect', 'none');

  -- Add some sample contacts for top companies
  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'Michael Chen', 'Plant Manager', 'mchen@skfood.com', '(206) 935-8101', true
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'SK Food Group';

  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'Sarah Johnson', 'Operations Director', 'sjohnson@skfood.com', '(206) 935-8102', false
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'SK Food Group';

  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'Robert Garcia', 'Facilities Manager', 'rgarcia@uda.com', '(480) 966-7212', true
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'United Dairymen of Arizona';

  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'Jennifer Lee', 'VP Operations', 'jlee@microchip.com', '(480) 792-7201', true
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'Microchip Technology';

  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'David Miller', 'Procurement Manager', 'dmiller@microchip.com', '(480) 792-7203', false
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'Microchip Technology';

  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'Amanda White', 'Plant Director', 'awhite@shamrock.com', '(602) 233-6401', true
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'Shamrock Foods';

  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'James Wilson', 'Facilities Director', 'jwilson@ngc.com', '(480) 425-6001', true
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'Northrop Grumman SMF';

  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'Lisa Anderson', 'Operations Manager', 'landerson@footprint.com', '(480) 456-9001', true
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'Footprint LLC';

  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'Thomas Brown', 'Maintenance Director', 'tbrown@swirecc.com', '(480) 775-7001', true
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'Swire Coca-Cola';

  INSERT INTO campaign_contacts (campaign_company_id, name, title, email, phone, is_primary)
  SELECT cc.id, 'Emily Davis', 'Engineering Manager', 'edavis@stryker.com', '(480) 792-1451', true
  FROM campaign_companies cc WHERE cc.campaign_id = new_campaign_id AND cc.name = 'Stryker Sustainability';

  RAISE NOTICE 'Phoenix Division campaign created with ID: %', new_campaign_id;
END $$;
