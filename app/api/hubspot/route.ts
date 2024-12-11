import { NextResponse } from 'next/server';
import { Client } from '@hubspot/api-client';

const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

const FALLBACK_DATA = {
  companies: [
    { name: 'ACME Corporation', industry: 'Technology', size: '1000', revenue: '$100M' },
    { name: 'Global Consulting Inc', industry: 'Consulting', size: '500', revenue: '$50M' },
    { name: 'TechStart Solutions', industry: 'Software', size: '100', revenue: '$5M' },
    { name: 'Enterprise Systems Ltd', industry: 'IT Services', size: '10000', revenue: '$10M' }
  ],
  positions: [
    'Chief Technology Officer',
    'VP of Engineering',
    'Director of Operations',
    'Head of Innovation',
    'Senior Product Manager',
    'Digital Transformation Lead'
  ],
  interactions: [
    'Attended product demo webinar',
    'Downloaded whitepaper on digital transformation',
    'Submitted a request for a demo of our product using our website',
    'Met at industry conference',
    'Participated in beta testing program'
  ]
};

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function formatRevenue(revenue: string): string {
  // Remove non-numeric characters except decimal point
  const numericValue = revenue.replace(/[^0-9.]/g, '');
  const number = parseFloat(numericValue);

  if (isNaN(number)) return revenue;

  if (number >= 1e9) {
    return `${(number / 1e9).toFixed(0)} billion dollars`;
  } else if (number >= 1e6) {
    return `${(number / 1e6).toFixed(0)} million dollars`;
  } else if (number >= 1e3) {
    return `${(number / 1e3).toFixed(0)} thousand dollars`;
  }
  
  return `${number} dollars`;
}

async function fetchContactInfo(email: string) {
  try {
    // Search for contact by email
    const contactsResponse = await hubspotClient.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: email
        }]
      }],
      properties: ['firstname', 'lastname', 'email', 'jobtitle', 'company']
    });

    console.log(contactsResponse);

    if (!contactsResponse.results?.[0]) {
      return null;
    }

    const contact = contactsResponse.results[0];
    const contactId = contact.id;

    // Get company data with fallback
    let companyData = null;
    try {
      console.log("Getting associated companies");
      const associationsResponse = await hubspotClient.crm.associations.v4.basicApi.getPage(
        'contacts',
        contactId,
        'companies'
      );

      console.log("Associations response:", associationsResponse);
      
      if (associationsResponse.results && associationsResponse.results.length > 0) {
        const lastCompanyId = associationsResponse.results[associationsResponse.results.length - 1].toObjectId;
        
        const companyResponse = await hubspotClient.crm.companies.basicApi.getById(
          lastCompanyId,
          ['name', 'industry', 'numberofemployees', 'annualrevenue']
        );
        
        companyData = companyResponse;
      } else {
        throw new Error('No associated companies found');
      }
    } catch (companyError) {
      console.error('Error fetching company data:', companyError);
      const fallbackCompany = getRandomElement(FALLBACK_DATA.companies);
      companyData = {
        properties: {
          name: fallbackCompany.name,
          industry: fallbackCompany.industry,
          numberofemployees: fallbackCompany.size,
          annualrevenue: fallbackCompany.revenue
        }
      };

      console.log("Using fallback company:", fallbackCompany);
    }

    // Fetch deals - Updated API call
    let deals = [];
    try {
      const dealsResponse = await hubspotClient.apiRequest({
        method: 'GET',
        path: `/crm/v3/objects/contacts/${contactId}/associations/deals`,
      });

      if (dealsResponse.results?.length) {
        deals = await Promise.all(
          dealsResponse.results.map(async (deal) => {
            try {
              const dealResponse = await hubspotClient.crm.deals.basicApi.getById(
                deal.toObjectId,
                ['dealname', 'dealstage', 'amount']
              );
              return dealResponse;
            } catch (dealError) {
              console.error('Error fetching deal:', dealError);
              return null;
            }
          })
        );
        deals = deals.filter(deal => deal !== null);
        console.log("Deals:", deals);
      }
    } catch (dealsError) {
      console.error('Error fetching deals:', dealsError);
      console.log("Using fallback deals");
    }

    const fallbackCompany = getRandomElement(FALLBACK_DATA.companies);
    console.log("Company:", companyData);
    // Format the data
    return {
      id: contactId,
      name: `${contact.properties.firstname || 'John'} ${contact.properties.lastname || 'Doe'}`,
      email: contact.properties.email,
      company: companyData?.properties?.name || getRandomElement(FALLBACK_DATA.companies).name,
      position: contact.properties.jobtitle || getRandomElement(FALLBACK_DATA.positions),
      painPoints: ['Cost optimization', 'Process efficiency', 'Digital transformation'],
      previousInteractions: [getRandomElement(FALLBACK_DATA.interactions)],
      companyDetails: {
        industry: companyData?.properties?.industry || fallbackCompany.industry,
        size: companyData?.properties?.numberofemployees || fallbackCompany.size,
        revenue: formatRevenue(companyData?.properties?.annualrevenue || fallbackCompany.revenue)
      }
    };
  } catch (error) {
    console.error('Error fetching HubSpot data:', error);
    
    // Return completely mocked data if HubSpot fails
    const fallbackCompany = getRandomElement(FALLBACK_DATA.companies);
    return {
      id: 'mock-' + Date.now(),
      name: 'John Doe',
      email: email,
      company: fallbackCompany.name,
      position: getRandomElement(FALLBACK_DATA.positions),
      painPoints: ['Cost optimization', 'Process efficiency', 'Digital transformation'],
      previousInteractions: [getRandomElement(FALLBACK_DATA.interactions)],
      companyDetails: {
        industry: fallbackCompany.industry,
        size: fallbackCompany.size,
        revenue: fallbackCompany.revenue
      }
    };
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' }, 
        { status: 400 }
      );
    }

    const prospectInfo = await fetchContactInfo(email);
    
    if (!prospectInfo) {
      return NextResponse.json(
        { error: 'Contact not found' }, 
        { status: 404 }
      );
    }

    return NextResponse.json(prospectInfo);
  } catch (error) {
    console.error('Error in HubSpot API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 