import { v4 as uuidv4 } from 'uuid';
import prisma from './prisma';

export async function seedDatabase() {
  console.log('Seeding NilePixel Offline Field Tracker database...');

  // Clean existing data for clean seed
  await prisma.activityLog.deleteMany({});
  await prisma.idempotencyRecord.deleteMany({});
  await prisma.report.deleteMany({});

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);

  const sampleReports = [
    {
      id: 'rpt-np-8821',
      reportNumber: 'NP-8821',
      title: 'Broken Water Point Handpump - Borehole 4',
      description:
        'Mechanical linkage fractured at fulcrum pin. Submersible cylinder jammed; 650 households currently without potable water source.',
      category: 'Water',
      priority: 'Critical',
      status: 'submitted',
      syncStatus: 'synced',
      latitude: 4.85124,
      longitude: 31.58241,
      locationName: 'Sector 4 Borehole - Juba Central',
      locationAccuracy: 3.8,
      reporterName: 'Sarah J.',
      reporterId: 'USR-089',
      assignedTo: null,
      assignedTeam: null,
      version: 1,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
      activities: [
        {
          action: 'created',
          actorName: 'Sarah J.',
          description: 'Report NP-8821 submitted from offline mobile cache',
          newValue: 'submitted',
          createdAt: hoursAgo(2),
        },
      ],
    },
    {
      id: 'rpt-np-8820',
      reportNumber: 'NP-8820',
      title: 'Culvert Erosion on Main Supply Route B-12',
      description:
        'Flash flood runoff compromised western wingwall. Shoulder collapse extends 1.8 meters into active road carriage.',
      category: 'Infrastructure',
      priority: 'High',
      status: 'assigned',
      syncStatus: 'synced',
      latitude: 4.86215,
      longitude: 31.59423,
      locationName: 'North Access Corridor KM 14',
      locationAccuracy: 4.2,
      reporterName: 'David O.',
      reporterId: 'USR-104',
      assignedTo: 'Mark T.',
      assignedTeam: 'Civil Works Crew 2',
      version: 2,
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(5),
      activities: [
        {
          action: 'created',
          actorName: 'David O.',
          description: 'Report NP-8820 created and submitted',
          newValue: 'submitted',
          createdAt: hoursAgo(8),
        },
        {
          action: 'status_change',
          actorName: 'Ahmed K.',
          description: 'Assigned to Mark T. (Civil Works Crew 2) for immediate stabilization',
          previousValue: 'submitted',
          newValue: 'assigned',
          createdAt: hoursAgo(5),
        },
      ],
    },
    {
      id: 'rpt-np-8819',
      reportNumber: 'NP-8819',
      title: 'Solar Inverter Fault - Health Clinic Compound',
      description:
        'Error code E-42 overcurrent trip. Vaccine cold-chain storage running on secondary backup battery with 4 hours remaining capacity.',
      category: 'Equipment',
      priority: 'Critical',
      status: 'in_progress',
      syncStatus: 'synced',
      latitude: 4.84331,
      longitude: 31.57118,
      locationName: 'Al-Wahda Health Compound',
      locationAccuracy: 2.5,
      reporterName: 'Dr. Amina L.',
      reporterId: 'USR-042',
      assignedTo: 'Ahmed K.',
      assignedTeam: 'Electrical Maintenance',
      version: 3,
      createdAt: hoursAgo(14),
      updatedAt: hoursAgo(1),
      activities: [
        {
          action: 'created',
          actorName: 'Dr. Amina L.',
          description: 'Critical electrical fault reported',
          newValue: 'submitted',
          createdAt: hoursAgo(14),
        },
        {
          action: 'status_change',
          actorName: 'Ahmed K.',
          description: 'Self-assigned to electrical response unit',
          previousValue: 'submitted',
          newValue: 'assigned',
          createdAt: hoursAgo(10),
        },
        {
          action: 'status_change',
          actorName: 'Ahmed K.',
          description: 'On-site diagnostic started: capacitor bank replacement underway',
          previousValue: 'assigned',
          newValue: 'in_progress',
          createdAt: hoursAgo(1),
        },
      ],
    },
    {
      id: 'rpt-np-8818',
      reportNumber: 'NP-8818',
      title: 'Perimeter Security Fence Breach Near Storage Yard',
      description:
        'Razor wire damaged along southern boundary section. 4-meter gap discovered during morning perimeter patrol.',
      category: 'Safety',
      priority: 'Medium',
      status: 'resolved',
      syncStatus: 'synced',
      latitude: 4.87052,
      longitude: 31.60229,
      locationName: 'East Logistics Base - Perimeter South',
      locationAccuracy: 5.1,
      reporterName: 'Sarah J.',
      reporterId: 'USR-089',
      assignedTo: 'Kariuki M.',
      assignedTeam: 'Base Security',
      resolutionNotes:
        'Reinforced chain-link mesh and tension wire installed. Secondary sensor beacon re-calibrated and verified.',
      resolvedBy: 'Ahmed K.',
      resolvedAt: hoursAgo(6),
      version: 4,
      createdAt: hoursAgo(28),
      updatedAt: hoursAgo(6),
      activities: [
        {
          action: 'created',
          actorName: 'Sarah J.',
          description: 'Fence breach logged',
          newValue: 'submitted',
          createdAt: hoursAgo(28),
        },
        {
          action: 'status_change',
          actorName: 'Ahmed K.',
          description: 'Assigned to Base Security team',
          previousValue: 'submitted',
          newValue: 'assigned',
          createdAt: hoursAgo(20),
        },
        {
          action: 'status_change',
          actorName: 'Kariuki M.',
          description: 'Repair crew deployed on-site',
          previousValue: 'assigned',
          newValue: 'in_progress',
          createdAt: hoursAgo(12),
        },
        {
          action: 'status_change',
          actorName: 'Ahmed K.',
          description: 'Perimeter verified secure; issue marked resolved',
          previousValue: 'in_progress',
          newValue: 'resolved',
          createdAt: hoursAgo(6),
        },
      ],
    },
    {
      id: 'rpt-np-8817',
      reportNumber: 'NP-8817',
      title: 'Routine Generator Maintenance Due - Base Echo',
      description:
        '250-hour oil change, fuel separator filter swap, and vibration damper inspection required for Perkins 45kVA generator.',
      category: 'Maintenance',
      priority: 'Low',
      status: 'in_progress',
      syncStatus: 'synced',
      latitude: 4.8554,
      longitude: 31.5891,
      locationName: 'Base Echo Operations Compound',
      locationAccuracy: 3.1,
      reporterName: 'Sarah J.',
      reporterId: 'USR-089',
      assignedTo: 'David O.',
      assignedTeam: 'Power Generation',
      version: 3,
      createdAt: hoursAgo(36),
      updatedAt: hoursAgo(18),
      activities: [
        {
          action: 'created',
          actorName: 'Sarah J.',
          description: 'Routine maintenance ticket created',
          newValue: 'submitted',
          createdAt: hoursAgo(36),
        },
        {
          action: 'status_change',
          actorName: 'Ahmed K.',
          description: 'Assigned to David O.',
          previousValue: 'submitted',
          newValue: 'assigned',
          createdAt: hoursAgo(24),
        },
        {
          action: 'status_change',
          actorName: 'David O.',
          description: 'Service kit obtained, maintenance started',
          previousValue: 'assigned',
          newValue: 'in_progress',
          createdAt: hoursAgo(18),
        },
      ],
    },
    {
      id: 'rpt-np-8816',
      reportNumber: 'NP-8816',
      title: 'Blocked Drainage Ditch East Sector',
      description:
        'Siltation buildup from seasonal runoff overflowing into adjacent agricultural plots.',
      category: 'Infrastructure',
      priority: 'Medium',
      status: 'rejected',
      syncStatus: 'synced',
      latitude: 4.8312,
      longitude: 31.5998,
      locationName: 'East Agricultural Canal 3',
      locationAccuracy: 6.0,
      reporterName: 'David O.',
      reporterId: 'USR-104',
      resolutionNotes:
        'Assigned under local municipal maintenance remit; duplicate of regional drainage plan.',
      resolvedBy: 'Ahmed K.',
      version: 2,
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(40),
      activities: [
        {
          action: 'created',
          actorName: 'David O.',
          description: 'Drainage blockage reported',
          newValue: 'submitted',
          createdAt: hoursAgo(48),
        },
        {
          action: 'status_change',
          actorName: 'Ahmed K.',
          description: 'Rejected: Out of NGO operational scope, transferred to municipal works',
          previousValue: 'submitted',
          newValue: 'rejected',
          createdAt: hoursAgo(40),
        },
      ],
    },
    {
      id: 'rpt-np-8815',
      reportNumber: 'NP-8815',
      title: 'Chlorine Dosing Pump Pressure Drop',
      description:
        'Chemical feed pump cavitation observed during morning quality control testing. Free residual chlorine below minimum threshold (0.2 mg/L).',
      category: 'Water',
      priority: 'High',
      status: 'submitted',
      syncStatus: 'synced',
      latitude: 4.83902,
      longitude: 31.56453,
      locationName: 'Nile River Intake & Water Station 1',
      locationAccuracy: 3.0,
      reporterName: 'Kariuki M.',
      reporterId: 'USR-118',
      version: 1,
      createdAt: hoursAgo(52),
      updatedAt: hoursAgo(52),
      activities: [
        {
          action: 'created',
          actorName: 'Kariuki M.',
          description: 'Water quality alert reported',
          newValue: 'submitted',
          createdAt: hoursAgo(52),
        },
      ],
    },
    {
      id: 'rpt-np-8814',
      reportNumber: 'NP-8814',
      title: 'Telecom Relay Mast 3 Lightning Arrester Damaged',
      description:
        'Grounding strap severed by electrical storm. Telemetry link to remote hydrological sensors intermittent.',
      category: 'Equipment',
      priority: 'Medium',
      status: 'draft',
      syncStatus: 'pending',
      latitude: 4.88204,
      longitude: 31.55402,
      locationName: 'Hilltop Transmission Site',
      locationAccuracy: 4.0,
      reporterName: 'Sarah J.',
      reporterId: 'USR-089',
      version: 1,
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(72),
      activities: [
        {
          action: 'created',
          actorName: 'Sarah J.',
          description: 'Initial draft saved locally',
          newValue: 'draft',
          createdAt: hoursAgo(72),
        },
      ],
    },
  ];

  for (const item of sampleReports) {
    const { activities, ...reportData } = item;
    await prisma.report.create({
      data: reportData,
    });

    for (const act of activities) {
      await prisma.activityLog.create({
        data: {
          id: uuidv4(),
          reportId: item.id,
          action: act.action,
          actorName: act.actorName,
          description: act.description,
          previousValue: (act as any).previousValue || null,
          newValue: act.newValue || null,
          createdAt: act.createdAt,
        },
      });
    }
  }

  // Pre-seed an initial IdempotencyRecord
  await prisma.idempotencyRecord.create({
    data: {
      key: 'seed-sync-key-001',
      response: JSON.stringify({
        success: true,
        action: 'create',
        reportNumber: 'NP-8821',
      }),
      createdAt: hoursAgo(2),
    },
  });

  console.log(`Seeded ${sampleReports.length} reports successfully.`);
}

