export interface ProspectInfo {
  id: string;
  name: string;
  company: string;
  position: string;
  painPoints: string[];
  previousInteractions: string[];
  industry: string;
}

export interface MeetingSummary {
  meetingId: string;
  prospectId: string;
  date: string;
  keyPoints: string[];
  nextSteps: string[];
  opportunities: string[];
}

export interface SalesContext {
  currentPhase: 'briefing' | 'meeting' | 'summary';
  prospectInfo?: ProspectInfo;
  meetingSummary?: MeetingSummary;
} 