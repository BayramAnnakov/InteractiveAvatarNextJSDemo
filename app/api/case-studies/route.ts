import { NextResponse } from 'next/server';

const caseStudies = [
  {
    id: '1',
    companyName: 'TechCorp Solutions',
    industry: 'Software',
    challenge: 'Needed to automate sales outreach to new leads',
    solution: 'Leveraged our AI-powered avatar system to automate sales outreach to new leads',
    results: [
      '300% increase in meeting booking rate',
    ],

  },
  // Add more case studies...
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get('industry');
  
  const filteredCases = industry 
    ? caseStudies.filter(cs => cs.industry.toLowerCase() === industry.toLowerCase())
    : caseStudies;
  
  if (filteredCases.length === 0) {
    return NextResponse.json([caseStudies[0]]);
  }

  return NextResponse.json(filteredCases);
} 