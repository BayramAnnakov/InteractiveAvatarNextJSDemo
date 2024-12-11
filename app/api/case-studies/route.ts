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
      '45% reduction in sales cycle length',
      '85% positive prospect feedback'
    ],
    testimonial: "The AI avatar system transformed our sales process, making it more efficient and personalized."
  },
  {
    id: '2', 
    companyName: 'Enterprise Systems Inc',
    industry: 'Information Technology and Services',
    challenge: 'Struggled with scaling personalized demos and product presentations',
    solution: 'Implemented AI avatars for product demonstrations and customer onboarding',
    results: [
      '200% increase in demo completion rates',
      '40% higher conversion from demo to purchase',
      'Reduced demo scheduling wait times by 75%'
    ],
    testimonial: "The AI avatars allowed us to provide consistent, high-quality demos 24/7."
  },
  {
    id: '3',
    companyName: 'Global Finance Group',
    industry: 'Financial_Services',
    challenge: 'High customer service representative turnover and training costs',
    solution: 'Deployed AI avatars for first-line customer support and common inquiries',
    results: [
      '60% reduction in support costs',
      '90% customer satisfaction rate',
      '24/7 support availability achieved'
    ],
    testimonial: "Our customers love the instant responses and consistent service quality."
  },
  {
    id: '4',
    companyName: 'HealthTech Solutions',
    industry: 'Healthcare',
    challenge: 'Needed to improve patient education and engagement',
    solution: 'Implemented AI avatars for patient education and follow-up care instructions',
    results: [
      '80% improvement in patient understanding',
      '40% reduction in follow-up questions',
      '95% patient satisfaction rate'
    ],
    testimonial: "Patients feel more comfortable asking questions and getting detailed explanations from the AI avatar."
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