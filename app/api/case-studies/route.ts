import { NextResponse } from 'next/server';

const caseStudies = [
  {
    id: '1',
    companyName: 'SalesForce Direct',
    industry: 'Software',
    challenge: 'Sales team was overwhelmed with initial prospect meetings and qualification calls',
    solution: 'Deployed interactive AI sales avatars to handle initial prospect meetings and qualification',
    results: [
      '400% increase in qualified leads processed',
      '65% reduction in sales rep burnout',
      '92% prospect satisfaction with initial meetings'
    ],
    testimonial: "The AI sales avatars handle our first meetings perfectly, letting our reps focus on closing deals."
  },
  {
    id: '2',
    companyName: 'Global Solutions Corp',
    industry: 'Information Technology and Services', 
    challenge: 'Needed 24/7 sales coverage across multiple time zones',
    solution: 'Implemented AI sales avatars to provide round-the-clock prospect engagement',
    results: [
      '300% increase in international lead conversion',
      'Sales coverage expanded to 24/7/365',
      '78% reduction in prospect wait times'
    ],
    testimonial: "Our AI sales avatars never sleep, ensuring we never miss an opportunity regardless of timezone."
  },
  {
    id: '3',
    companyName: 'TechStart Ventures',
    industry: 'Financial_Services',
    challenge: 'High cost of training junior sales reps and inconsistent prospect experiences',
    solution: 'Adopted AI sales avatars to standardize initial prospect engagement',
    results: [
      '85% reduction in initial training costs',
      '95% consistency in prospect qualification',
      'Doubled qualified pipeline generation'
    ],
    testimonial: "The AI avatars deliver perfectly consistent prospect experiences while our reps focus on relationships."
  },
  {
    id: '4',
    companyName: 'MedTech Innovations',
    industry: 'Healthcare',
    challenge: 'Complex product explanations taking up too much sales rep time',
    solution: 'Leveraged AI sales avatars for initial product demonstrations and feature explanations',
    results: [
      '75% reduction in rep time spent on basic demos',
      '90% prospect comprehension rate',
      '3x increase in qualified opportunities'
    ],
    testimonial: "Our AI sales avatars handle the heavy lifting of product education, freeing our reps to focus on consultative selling."
  }
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get('industry');
  
  const filteredCases = industry?.toLowerCase().includes('information')
    ? caseStudies.filter(cs => cs.industry === 'Information Technology and Services')
    : industry 
      ? caseStudies.filter(cs => cs.industry.toLowerCase() === industry.toLowerCase())
      : caseStudies;
  
  if (filteredCases.length === 0) {
    return NextResponse.json([caseStudies[0]]);
  }

  return NextResponse.json(filteredCases);
} 