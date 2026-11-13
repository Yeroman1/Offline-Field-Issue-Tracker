import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { computePayloadHash } from '../utils/hash.util';

export async function seedDatabase() {
  console.log('Seeding NilePixel Offline Field Tracker database...');

  // Clean existing data for clean seed
  await prisma.activityLog.deleteMany({});
  await prisma.statusTransition.deleteMany({});
  await prisma.syncMetadata.deleteMany({});
  await prisma.idempotencyRecord.deleteMany({});
  await prisma.report.deleteMany({});

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);

  const sampleReports = [
    {
      id: 'rpt-np-8821',
      clientReportId: 'c1111111-1111-4111-8111-111111111111',
      reportNumber: 'NP-8821',
      title: 'Broken Water Point Handpump - Borehole 4',
      description:
        'Mechanical linkage fractured at fulcrum pin. Submersible cylinder jammed; 650 households currently without potable water source.',
      category: 'BROKEN_WATER',
      priority: 'CRITICAL',
      status: 'SUBMITTED',
      syncStatus: 'SYNCED',
      latitude: 4.85124,
      longitude: 31.58241,
      locationName: 'Sector 4 Borehole - Juba Central',
      location: 'Sector 4 Borehole - Juba Central',
      locationAccuracy: 3.8,
      reporterName: 'Sarah J.',
      reporterId: '00000000-0000-0000-0000-000000000089',
      sourceDeviceId: 'device-android-field-01',
      assignedTo: null,
      assignedTeam: null,
      version: 1,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
      activities: [
        {
          action: 'REPORT_CREATED',
          actorName: 'Sarah J.',
          description: 'Report NP-8821 submitted from offline mobile cache',
          newValue: 'SUBMITTED',
          createdAt: hoursAgo(2),
        },
      ],
    },
    {
      id: 'rpt-np-8820',
      clientReportId: 'c2222222-2222-4222-8222-222222222222',
      reportNumber: 'NP-8820',
      title: 'Culvert Erosion on Main Supply Route B-12',
      description:
        'Flash flood runoff compromised western wingwall. Shoulder collapse extends 1.8 meters into active road carriage.',
      category: 'MAINTENANCE_REQUIRED',
      priority: 'HIGH',
      status: 'ASSIGNED',
      syncStatus: 'SYNCED',
      latitude: 4.86215,
      longitude: 31.59423,
      locationName: 'North Access Corridor KM 14',
      location: 'North Access Corridor KM 14',
      locationAccuracy: 4.2,
      reporterName: 'John D.',
      reporterId: '00000000-0000-0000-0000-000000000092',
      sourceDeviceId: 'device-android-field-02',
      assignedTo: 'Kariuki M.',
      assignedTeam: 'Civil Works Team B',
      version: 2,
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(4),
      activities: [
        {
          action: 'REPORT_CREATED',
          actorName: 'John D.',
          description: 'Road damage reported via emergency intake',
          newValue: 'SUBMITTED',
          createdAt: hoursAgo(8),
        },
        {
          action: 'STATUS_UPDATED',
          actorName: 'Ahmed K.',
          description: 'Dispatched Civil Works Team B for initial culvert shoring',
          previousValue: 'SUBMITTED',
          newValue: 'ASSIGNED',
          createdAt: hoursAgo(4),
        },
      ],
    },
    {
      id: 'rpt-np-8818',
      clientReportId: 'c3333333-3333-4333-8333-333333333333',
      reportNumber: 'NP-8818',
      title: 'Perimeter Security Fence Breach Near Storage Yard',
      description:
        'Razor wire damaged along southern boundary section. 4-meter gap discovered during morning perimeter patrol.',
      category: 'SAFETY_CONCERN',
      priority: 'MEDIUM',
      status: 'RESOLVED',
      syncStatus: 'SYNCED',
      latitude: 4.87052,
      longitude: 31.60229,
      locationName: 'East Logistics Base - Perimeter South',
      location: 'East Logistics Base - Perimeter South',
      locationAccuracy: 5.1,
      reporterName: 'Sarah J.',
      reporterId: '00000000-0000-0000-0000-000000000089',
      sourceDeviceId: 'device-android-field-01',
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
          action: 'REPORT_CREATED',
          actorName: 'Sarah J.',
          description: 'Fence breach logged',
          newValue: 'SUBMITTED',
          createdAt: hoursAgo(28),
        },
        {
          action: 'STATUS_UPDATED',
          actorName: 'Ahmed K.',
          description: 'Assigned to Base Security team',
          previousValue: 'SUBMITTED',
          newValue: 'ASSIGNED',
          createdAt: hoursAgo(20),
        },
        {
          action: 'STATUS_UPDATED',
          actorName: 'Kariuki M.',
          description: 'Repair crew deployed on-site',
          previousValue: 'ASSIGNED',
          newValue: 'IN_PROGRESS',
          createdAt: hoursAgo(12),
        },
        {
          action: 'STATUS_UPDATED',
          actorName: 'Ahmed K.',
          description: 'Repairs inspected and cleared. Issue closed.',
          previousValue: 'IN_PROGRESS',
          newValue: 'RESOLVED',
          createdAt: hoursAgo(6),
        },
      ],
    },
    {
      id: 'rpt-np-8814',
      clientReportId: 'c4444444-4444-4444-8444-444444444444',
      reportNumber: 'NP-8814',
      title: 'Telecom Relay Mast 3 Lightning Arrester Damaged',
      description:
        'Grounding strap severed by electrical storm. Telemetry link to remote hydrological sensors intermittent.',
      category: 'DAMAGED_EQUIPMENT',
      priority: 'MEDIUM',
      status: 'DRAFT',
      syncStatus: 'PENDING',
      latitude: 4.88204,
      longitude: 31.55402,
      locationName: 'Hilltop Transmission Site',
      location: 'Hilltop Transmission Site',
      locationAccuracy: 4.0,
      reporterName: 'Sarah J.',
      reporterId: '00000000-0000-0000-0000-000000000089',
      sourceDeviceId: 'device-android-field-01',
      version: 1,
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(72),
      activities: [
        {
          action: 'REPORT_CREATED',
          actorName: 'Sarah J.',
          description: 'Initial draft saved locally',
          newValue: 'DRAFT',
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

    await prisma.syncMetadata.create({
      data: {
        id: uuidv4(),
        reportId: item.id,
        syncStatus: item.syncStatus,
        attemptCount: 1,
        lastAttemptAt: item.createdAt,
        acknowledgedAt: item.syncStatus === 'SYNCED' ? item.createdAt : null,
      },
    });

    await prisma.statusTransition.create({
      data: {
        id: uuidv4(),
        reportId: item.id,
        fromStatus: 'DRAFT',
        toStatus: item.status,
        actorId: item.reporterId,
        note: `Initial status set to ${item.status}`,
        createdAt: item.createdAt,
      },
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
  const seedPayload = { test: 'seed-sync-key-001' };
  await prisma.idempotencyRecord.create({
    data: {
      key: 'seed-sync-key-001',
      payloadHash: computePayloadHash(seedPayload),
      statusCode: 200,
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
