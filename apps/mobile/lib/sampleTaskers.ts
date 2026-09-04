const NAMES = [
  'Kasun Perera',
  'Nuwan Silva',
  'Ravindu Fernando',
  'Dinesh Rajapaksa',
  'Tharindu Jayasuriya',
  'Sachini Dias',
  'Shanaka Bandara',
  'Isuru Weerasinghe',
  'Lasitha Gunaratne',
  'Chamari Athukorala',
]

const BIOS = [
  'Verified local expert',
  'Trained and background-checked tasker',
  'Focused on quality workmanship',
  'On-time, reliable, and detail-oriented',
  'Trusted by hundreds of local homes',
]

export function buildSampleTaskers(job: any) {
  const jobName = job?.name || 'this service'
  const avg = job ? Math.round(((job.priceMin || 0) + (job.priceMax || 0)) / 2) : 15000
  return NAMES.slice(0, 5).map((name, i) => ({
    id: `sample-tasker-${i + 1}`,
    userId: `sample-user-${i + 1}`,
    name,
    bio: `${jobName} — ${BIOS[i % BIOS.length]}`,
    rating: +(4.3 + (i % 6) * 0.1).toFixed(1),
    completedJobs: 18 + i * 23,
    isVerified: i % 3 !== 0,
    isOnline: i % 2 === 0,
    distance: 1.5 + i * 1.8,
    skills: [jobName, 'Repair & Maintenance'],
    hourlyRate: Math.max(800, Math.round((avg / 6) / 100) * 100),
    fixedRate: avg,
    experienceYears: 2 + (i % 5),
  }))
}

export function buildSampleProfile(taskerId: string, jobId?: string) {
  const idxMatch = /^sample-tasker-(\d+)$/.exec(taskerId)
  const idx = idxMatch ? parseInt(idxMatch[1], 10) - 1 : -1
  const name = idx >= 0 ? NAMES[idx] : (jobId || 'Tasker').replace(/-/g, ' ')
  const rate = 1500 + (idx >= 0 ? idx * 250 : 0)
  return {
    id: taskerId,
    userId: taskerId.replace('tasker', 'user'),
    user: { id: taskerId, name },
    name,
    bio: `${jobId ? jobId.replace(/-/g, ' ') + ' — ' : ''}Focused on quality workmanship and on-time service.`,
    rating: 4.6,
    completedJobs: 84,
    isVerified: true,
    isOnline: true,
    avgResponseMin: 12,
    completionRate: 98,
    skills: ['Repair & Maintenance'],
    serviceAreas: ['Colombo', 'Gampaha', 'Kalutara'],
    hourlyRate: rate,
    fixedRate: rate * 4,
    experienceYears: 6,
    reviews: [
      { id: 's1', reviewerName: 'Nilani F.', rating: 5, comment: 'Very professional and quick. Highly recommended.' },
      { id: 's2', reviewerName: 'Ruwan C.', rating: 4, comment: 'Good quality work at a fair price.' },
    ],
  }
}