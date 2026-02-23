# New Project Build Questionnaire

## Project Overview

### Business Information
- **Company Name:** _______________
- **Industry/Domain:** _______________
- **Primary Business Activity:** _______________
- **Number of Users (Estimated):** _______________
- **Number of Locations:** _______________
- **Project Timeline:** _______________
- **Budget Range:** _______________

### Project Purpose
- **What problem are we solving?**


- **What are the top 3 business goals?**
  1.
  2.
  3.

- **Who are the primary users?** (roles/departments)


---

## Core Global Entities

### 1. Users & Authentication
- [ ] Do you need user accounts?
- [ ] Authentication method:
  - [ ] Username/Password
  - [ ] Email/Password
  - [ ] SSO (Single Sign-On)
  - [ ] Multi-factor authentication
  - [ ] Other: _______________

**User Roles Needed:**
- [ ] Admin
- [ ] Manager
- [ ] Standard User
- [ ] Read-only/Guest
- [ ] Custom roles: _______________

**User Profile Information:**
- [ ] Name (First, Last)
- [ ] Email
- [ ] Phone
- [ ] Title/Position
- [ ] Department
- [ ] Profile Photo
- [ ] Other fields: _______________

### 2. Employees
- [ ] Do you need a separate employee database (vs users)?
- [ ] If yes, what's the difference between users and employees?

**Employee Information Needed:**
- [ ] Basic Info (Name, Email, Phone)
- [ ] Job Title
- [ ] Department
- [ ] Hire Date
- [ ] Employment Status (Active, Inactive, On Leave)
- [ ] Skills/Certifications
- [ ] Pay Rate/Salary (if applicable)
- [ ] Emergency Contact
- [ ] Manager/Supervisor
- [ ] Other: _______________

### 3. Customers
- [ ] Do you need a customer database?

**Customer Type:**
- [ ] B2B (Business customers)
- [ ] B2C (Individual consumers)
- [ ] Both

**Customer Information Needed:**
- [ ] Company Name
- [ ] Contact Person(s)
- [ ] Email
- [ ] Phone
- [ ] Address (Billing)
- [ ] Address (Shipping/Service)
- [ ] Website
- [ ] Tax ID / Business License
- [ ] Credit Terms
- [ ] Notes/History
- [ ] Other: _______________

### 4. Vendors/Suppliers
- [ ] Do you need a vendor/supplier database?

**Vendor Information Needed:**
- [ ] Company Name
- [ ] Contact Person(s)
- [ ] Email/Phone
- [ ] Address
- [ ] Products/Services Provided
- [ ] Payment Terms
- [ ] Account Numbers
- [ ] Other: _______________

### 5. Departments/Teams
- [ ] Do you need to track departments/teams?

**Department Structure:**
- [ ] Simple list of departments
- [ ] Hierarchical (departments have sub-departments)
- [ ] Matrix (employees can belong to multiple teams)

**Department Information:**
- [ ] Department Name
- [ ] Department Manager
- [ ] Budget/Cost Center
- [ ] Other: _______________

### 6. Locations/Facilities
- [ ] Do you need to track multiple locations?

**Location Information:**
- [ ] Name
- [ ] Address
- [ ] Type (Office, Warehouse, Job Site, etc.)
- [ ] Manager
- [ ] Other: _______________

### 7. Products/Services
- [ ] Do you need a product catalog?
- [ ] Do you need a service catalog?

**Product/Service Information:**
- [ ] Name/Description
- [ ] SKU/Part Number
- [ ] Category
- [ ] Price/Rate
- [ ] Unit of Measure
- [ ] Images
- [ ] Specifications
- [ ] Inventory Tracking
- [ ] Other: _______________

---

## Feature Modules

### Project Management
- [ ] Projects tracking
- [ ] Tasks/To-dos
- [ ] Milestones
- [ ] Timeline/Gantt charts
- [ ] Project budgets
- [ ] Time tracking
- [ ] Resource allocation

**Project Information Needed:**
- [ ] Project Name
- [ ] Customer
- [ ] Start/End Dates
- [ ] Budget
- [ ] Status
- [ ] Project Manager
- [ ] Team Members
- [ ] Other: _______________

### Document Management
- [ ] File uploads/attachments
- [ ] Document categorization
- [ ] Version control
- [ ] Document approval workflow

**Document Types:**
_______________

### Financial Management
- [ ] Estimates/Quotes
- [ ] Proposals
- [ ] Invoicing
- [ ] Expense tracking
- [ ] Purchase Orders
- [ ] Payment tracking
- [ ] Financial reporting

**Financial Features Needed:**
_______________

### Inventory Management
- [ ] Inventory tracking
- [ ] Stock levels/alerts
- [ ] Purchase orders
- [ ] Receiving
- [ ] Asset tracking

### Communication & Collaboration
- [ ] Internal messaging
- [ ] Email notifications
- [ ] Comments/Notes on records
- [ ] Activity logs/audit trails
- [ ] Client portal

### Workflow & Approvals
- [ ] Approval workflows
- [ ] Status tracking
- [ ] Automated notifications
- [ ] Task assignments

**Approval Processes Needed:**
_______________

### Reporting & Analytics
- [ ] Dashboard
- [ ] Standard reports (list them):

- [ ] Custom report builder
- [ ] Data export (Excel, PDF, CSV)

### Scheduling & Calendar
- [ ] Calendar/scheduling
- [ ] Resource booking
- [ ] Appointments
- [ ] Recurring events

### Forms & Data Collection
- [ ] Custom forms
- [ ] Mobile data collection
- [ ] Photo capture
- [ ] Signature capture
- [ ] QR code scanning

### Integration Requirements
- [ ] QuickBooks
- [ ] Accounting software: _______________
- [ ] Email (Gmail, Outlook)
- [ ] Calendar sync
- [ ] Payment processing
- [ ] Other: _______________

---

## Industry-Specific Modules

### Construction (Like Titan)
- [ ] RFIs (Requests for Information)
- [ ] Submittals
- [ ] Change Orders
- [ ] Daily Reports
- [ ] Schedule of Values
- [ ] Punch Lists
- [ ] Equipment tracking
- [ ] Safety/Inspections
- [ ] Trade/Crew tracking

### Service Business
- [ ] Work Orders
- [ ] Service Tickets
- [ ] Dispatch
- [ ] Service Agreements
- [ ] Recurring maintenance
- [ ] Equipment/Asset history

### Sales/CRM
- [ ] Lead tracking
- [ ] Opportunities/Pipeline
- [ ] Sales campaigns
- [ ] Contact management
- [ ] Email campaigns
- [ ] Quote generation

### Other Industry Needs:
_______________

---

## Workflows & Business Rules

### Key Workflows to Map Out

**Workflow 1:** _______________
- Trigger: _______________
- Steps:
  1.
  2.
  3.
- Who is involved: _______________
- Approval requirements: _______________

**Workflow 2:** _______________
- Trigger: _______________
- Steps:
  1.
  2.
  3.
- Who is involved: _______________
- Approval requirements: _______________

**Workflow 3:** _______________
- Trigger: _______________
- Steps:
  1.
  2.
  3.
- Who is involved: _______________
- Approval requirements: _______________

### Numbering/Naming Conventions
- [ ] Auto-incrementing numbers (e.g., INV-2026-0001)
- [ ] Custom prefixes by type
- [ ] Numbering per customer/project
- [ ] Other: _______________

**Numbering Examples Needed:**
_______________

### Status Values
What are the status values for each entity?

**Projects:** Draft, Active, On Hold, Completed, Cancelled
**Tasks:** _______________
**Documents:** _______________
**Orders:** _______________
**Other:** _______________

---

## Technical Requirements

### Access & Permissions
- [ ] Multi-tenant (each customer has isolated data)
- [ ] Single tenant (one company only)
- [ ] Role-based permissions (who can see/edit what)
- [ ] Field-level security
- [ ] Record-level security

**Permission Examples:**
- Managers can approve expenses > $1000
- Users can only see their own projects
- Other: _______________

### Mobile Requirements
- [ ] Mobile-friendly web app
- [ ] Native mobile app (iOS/Android)
- [ ] Offline capability
- [ ] GPS/location tracking
- [ ] Photo capture
- [ ] Barcode/QR scanning

### Data & Storage
- [ ] File uploads (estimates for volume): _______________
- [ ] Image storage (estimates): _______________
- [ ] Video storage: _______________
- [ ] Data retention policies: _______________
- [ ] Backup requirements: _______________

### Email & Notifications
- [ ] Email notifications
- [ ] SMS notifications
- [ ] In-app notifications
- [ ] Scheduled/automated emails

**Email Templates Needed:**
_______________

### Customization Needs
- [ ] Custom fields per module
- [ ] Custom branding (logo, colors)
- [ ] Custom email templates
- [ ] Configurable workflows
- [ ] Custom reports

---

## Deployment & Hosting

### Hosting Preference
- [ ] Cloud-hosted (we host it)
- [ ] Customer's cloud account
- [ ] On-premise server
- [ ] Other: _______________

### Domain & URLs
- [ ] Subdomain (e.g., customerName.yourdomain.com)
- [ ] Custom domain (e.g., app.customerdomain.com)
- [ ] White-label completely

### Security & Compliance
- [ ] SSL/HTTPS
- [ ] Data encryption
- [ ] Compliance requirements (HIPAA, SOC2, GDPR, etc.): _______________
- [ ] Regular backups
- [ ] Disaster recovery plan

---

## Data Migration

### Existing Data to Import
- [ ] Customer list
- [ ] Employee list
- [ ] Products/Services
- [ ] Projects/Jobs
- [ ] Financial history
- [ ] Documents/Files
- [ ] Other: _______________

**Source System:**
_______________

**Data Format:**
- [ ] Excel/CSV
- [ ] Database export
- [ ] API
- [ ] Manual entry acceptable

**Estimated Records:**
- Customers: _______________
- Employees: _______________
- Products: _______________
- Other: _______________

---

## Training & Support

### Training Needs
- [ ] Admin training
- [ ] End-user training
- [ ] Video tutorials
- [ ] Written documentation
- [ ] Live training sessions

**Number of users needing training:** _______________

### Ongoing Support
- [ ] Email support
- [ ] Phone support
- [ ] Ticketing system
- [ ] Dedicated support contact
- [ ] SLA requirements: _______________

---

## Success Metrics

### How will we measure success?
1.
2.
3.

### Launch Criteria
What needs to be working for Day 1 launch?
- [ ]
- [ ]
- [ ]

### Phase 2+ Features
What can wait for later phases?
- [ ]
- [ ]
- [ ]

---

## Notes & Additional Requirements

**Special Considerations:**


**Known Challenges:**


**Reference Systems:**
(Any systems they like or want to emulate)


**Deal Breakers:**
(What absolutely must work or must not happen)


---

## Next Steps

**Completed by:** _______________
**Date:** _______________
**Follow-up meeting:** _______________

