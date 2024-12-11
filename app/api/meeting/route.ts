import { NextResponse } from 'next/server';
import { Client } from '@hubspot/api-client';
import { MeetingSummary } from '@/app/types/sales';

const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

export async function POST(request: Request) {
  try {
    const meetingSummary: MeetingSummary = await request.json();

    // Create a note using the updated API
    const noteBody = `
Meeting Summary:
Date: ${meetingSummary.date}

Key Points:
${meetingSummary.keyPoints.map(point => `- ${point}`).join('\n')}

Next Steps:
${meetingSummary.nextSteps.map(step => `- ${step}`).join('\n')}

Opportunities:
${meetingSummary.opportunities.map(opp => `- ${opp}`).join('\n')}
    `;

    // Create note with association using the correct API format
    const noteResponse = await hubspotClient.apiRequest({
      method: 'POST',
      path: '/crm/v3/objects/notes',
      body: {
        properties: {
          hs_note_body: noteBody,
          hs_timestamp: new Date().toISOString()
        }
      }
    });

    const noteData = await noteResponse.json();

    // Create association for the note
    if (noteData.id) {
      await hubspotClient.apiRequest({
        method: 'PUT',
        path: `/crm/v3/objects/notes/${noteData.id}/associations/contacts/${meetingSummary.prospectId}/note_to_contact`,
      });
    }

    // Create follow-up task
    if (meetingSummary.nextSteps.length > 0) {
      const taskResponse = await hubspotClient.apiRequest({
        method: 'POST',
        path: '/crm/v3/objects/tasks',
        body: {
          properties: {
            hs_task_body: `Follow up on meeting with ${meetingSummary.prospectId}`,
            hs_task_priority: 'HIGH',
            hs_task_status: 'NOT_STARTED',
            hs_task_subject: 'Follow up on sales meeting',
            hs_timestamp: new Date().toISOString()
          }
        }
      });

      const taskData = await taskResponse.json();

      // Create association for the task
      if (taskData.id) {
        await hubspotClient.apiRequest({
          method: 'PUT',
          path: `/crm/v3/objects/tasks/${taskData.id}/associations/contacts/${meetingSummary.prospectId}/task_to_contact`,
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      meetingId: noteData.id 
    });

  } catch (error) {
    console.error('Error saving meeting summary:', error);
    return NextResponse.json(
      { error: 'Failed to save meeting summary' }, 
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' }, 
        { status: 400 }
      );
    }

    const noteResponse = await hubspotClient.apiRequest({
      method: 'GET',
      path: `/crm/v3/objects/notes/${meetingId}`,
      qs: { properties: ['hs_note_body', 'hs_timestamp'] }
    });

    const noteData = await noteResponse.json();
    return NextResponse.json(noteData);

  } catch (error) {
    console.error('Error fetching meeting summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meeting summary' }, 
      { status: 500 }
    );
  }
} 