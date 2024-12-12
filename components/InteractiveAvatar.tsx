import type { StartAvatarResponse } from "@heygen/streaming-avatar";

import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents, TaskMode, TaskType, VoiceEmotion,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Input,
  Select,
  SelectItem,
  Spinner,
  Chip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, usePrevious } from "ahooks";
import { motion, AnimatePresence } from 'framer-motion';

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";

import {AVATARS, STT_LANGUAGE_LIST} from "@/app/lib/constants";
import { ProspectInfo, MeetingSummary, SalesContext } from "@/app/types/sales";
import ChromaKeyVideo from './ChromaKeyVideo';

type MeetingPhase = 'briefing' | 'meeting' | 'case-study' | 'summary';

interface CaseStudy {
  id: string;
  companyName: string;
  industry: string;
  challenge: string;
  solution: string;
  results: string[];
  testimonial?: string;
  logoUrl?: string;
}

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [prospectEmail, setProspectEmail] = useState<string>("");

  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("text_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);

  const [salesContext, setSalesContext] = useState<SalesContext>({
    currentPhase: 'briefing'
  });
  const [prospectInfo, setProspectInfo] = useState<ProspectInfo>();
  const [meetingSummary, setMeetingSummary] = useState<MeetingSummary>();
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy>();

  const [language, setLanguage] = useState<string>('en');

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
    }

    return "";
  }

  async function startSession() {
    setIsLoadingSession(true);
    const newToken = await fetchAccessToken();

    avatar.current = new StreamingAvatar({
      token: newToken,
    });
    avatar.current.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
      console.log("Avatar started talking", e);
    });
    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
      console.log("Avatar stopped talking", e);
    });
    avatar.current.on(StreamingEvents.STREAM_DISCONNECTED, () => {
      console.log("Stream disconnected");
      endSession();
    });
    avatar.current?.on(StreamingEvents.STREAM_READY, (event) => {
      console.log(">>>>> Stream ready:", event.detail);
      setStream(event.detail);
    });
    avatar.current?.on(StreamingEvents.USER_START, (event) => {
      console.log(">>>>> User started talking:", event);
      // handleInterrupt();
    });
    avatar.current?.on(StreamingEvents.USER_STOP, (event) => {
      console.log(">>>>> User stopped talking:", event);
    });
    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Medium,
        avatarName: "Anna_public_3_20240108",
        voice: {
          rate: 1.2,
          emotion: VoiceEmotion.EXCITED,
        },
        language: 'en',
        disableIdleTimeout: true,
        
      });

      setData(res);
      
      await fetchProspectInfo(prospectEmail);
      
      await avatar.current?.startVoiceChat({
        useSilencePrompt: false
      });

      setChatMode("text_mode");

    } catch (error) {
      console.error("Error starting avatar session:", error);
      setDebug("Error starting session: " + (error as Error).message);
    } finally {
      setIsLoadingSession(false);
    }
  }
  async function handleSpeak() {
    setIsLoadingRepeat(true);
    if (!avatar.current) {
      setDebug("Avatar API not initialized");

      return;
    }
    // speak({ text: text, task_type: TaskType.REPEAT })
    await avatar.current.speak({ 
      text: text, 
      taskType: TaskType.REPEAT, 
      taskMode: TaskMode.SYNC 
    }).catch((e) => {
      setDebug(e.message);
    });
    setIsLoadingRepeat(false);
  }
  async function handleInterrupt() {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");

      return;
    }
    await avatar.current
      .interrupt()
      .catch((e) => {
        setDebug(e.message);
      });
  }
  async function endSession() {
    await avatar.current?.stopAvatar();
    setStream(undefined);
  }

  const handleChangeChatMode = useMemoizedFn(async (v) => {
    if (v === chatMode) {
      return;
    }
    if (v === "text_mode") {
      avatar.current?.closeVoiceChat();
    } else {
      await avatar.current?.startVoiceChat();
    }
    setChatMode(v);
  });

  const previousText = usePrevious(text);
  useEffect(() => {
    if (!previousText && text) {
      avatar.current?.startListening();
    } else if (previousText && !text) {
      avatar?.current?.stopListening();
    }
  }, [text, previousText]);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, []);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
        setDebug("Playing");
      };
    }
  }, [mediaStream, stream]);

  async function fetchProspectInfo(email: string) {
    try {
      const response = await fetch(`/api/hubspot?email=${encodeURIComponent(email)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch prospect info');
      }
      
      const data = await response.json();
      console.log('Prospect data:', data);
      setProspectInfo(data);
      
      if (!data.name) {
        throw new Error('Invalid prospect data received');
      }
      
      const briefing = `Let me brief you about ${data.name} from ${data.company}. 
      They are the ${data.position} and their company is in the ${data.companyDetails.industry} industry 
      with ${data.companyDetails.size} employees and ${data.companyDetails.revenue} in annual revenue. 
      Previous interactions include: ${data.previousInteractions.join(', ')}.`;
      
      if (avatar.current) {
        await avatar.current.speak({ 
          text: briefing, 
          taskType: TaskType.REPEAT, 
          taskMode: TaskMode.SYNC 
        });
      }
    } catch (error) {
      console.error("Error fetching prospect info:", error);
      setDebug("Error fetching prospect info: " + (error as Error).message);
    }
  }

  async function submitMeetingSummary(summary: MeetingSummary) {
    try {
      const response = await fetch('/api/meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(summary),
      });
      const data = await response.json();
      setDebug(`Meeting summary submitted: ${data.meetingId}`);
    } catch (error) {
      console.error("Error submitting meeting summary:", error);
      setDebug("Error submitting meeting summary");
    }
  }

  async function fetchRelevantCaseStudies() {
    try {
      const response = await fetch(`/api/case-studies?industry=${encodeURIComponent(prospectInfo?.industry || '')}`);
      const data = await response.json();
      setCaseStudies(data);
      return data[0]; // Get most relevant case study
    } catch (error) {
      console.error("Error fetching case studies:", error);
      setDebug("Error fetching case studies: " + (error as Error).message);
    }
  }

  async function handlePhaseChange(newPhase: MeetingPhase) {
    if (!avatar.current) return;

    setSalesContext(prev => ({ 
      ...prev, 
      currentPhase: newPhase as "briefing" | "meeting" | "summary" 
    }));

    handleInterrupt();
    
    let message = '';
    switch (newPhase) {
      case 'briefing':
        if (prospectInfo) {
          message = `Let me brief you about ${prospectInfo.name} from ${prospectInfo.company}. 
          They are the ${prospectInfo.position} and their company is in the ${prospectInfo.companyDetails.industry} industry
          with ${prospectInfo.companyDetails.size} employees and ${prospectInfo.companyDetails.revenue} in annual revenue.
          Previous interactions include: ${prospectInfo.previousInteractions.join(', ')}.`;
        }
        break;
      
      case 'meeting':
        message = "You mentioned one of our competitors - Hooli - earlier. Could you tell me more about your experience with them and what specific aspects made you consider alternatives?";
        break;
      
      case 'case-study':
        try {
          const relevantCase = await fetchRelevantCaseStudies();
          if (!relevantCase) {
            message = "I apologize, but I couldn't find a directly relevant case study at the moment. However, I'd be happy to discuss how our solution could address your specific needs.";
            setSelectedCaseStudy(undefined);
          } else {
            setSelectedCaseStudy(relevantCase);
            message = `Let me share a relevant success story from ${relevantCase.companyName}. 
              They faced similar challenges in the ${relevantCase.industry} industry. 
              ${relevantCase.challenge} 
              We implemented ${relevantCase.solution} 
              This resulted in ${relevantCase.results.join(', ')}. 
              ${relevantCase.testimonial ? `Their team shared that "${relevantCase.testimonial}"` : ''}
              How does this align with your current situation?`;
          }
        } catch (error) {
          console.error("Error in case study phase:", error);
          message = "I apologize, but I'm having trouble accessing our case studies at the moment. Would you like to discuss how our solution could help your specific situation instead?";
          setSelectedCaseStudy(undefined);
        }
        break;
      
      case 'summary':
        message = "Let me summarize the key points from this meeting. We discussed your experience with Hooli and identified areas where our solution could provide better value. I'll make sure to send over demo access credentials and the presentation we shared today. Our team will follow up with next steps.";
        
        const summary: MeetingSummary = {
          meetingId: crypto.randomUUID(),
          prospectId: prospectInfo?.id ?? '456',
          date: new Date().toISOString(),
          keyPoints: [
            'Discussed pain points with current provider Hooli',
            'Presented our solution differentiators',
            'Demonstrated key features aligned with prospect needs'
          ],
          nextSteps: [
            'Send demo access credentials',
            'Share presentation materials',
            'Schedule follow-up call next week'
          ],
          opportunities: [
            'Proposal for a pilot project',
            'Request for a demo',
            'Invitation for a trial period'
          ]
        };
        
        await submitMeetingSummary(summary);
        break;
    }

    if (message && avatar.current) {
      await avatar.current.speak({ 
        text: message, 
        taskType: TaskType.REPEAT, 
        taskMode: TaskMode.SYNC 
      });
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && prospectEmail) {
      startSession();
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#000000] text-white font-sf-pro">
      {/* Phase indicator with Apple-style animations */}
      <div className="max-w-7xl mx-auto py-8">
        <motion.div 
          className="flex justify-center gap-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {['Briefing', 'Meeting', 'Case Study', 'Summary'].map((phase) => (
            <motion.button
              key={phase}
              onClick={() => handlePhaseChange(phase.toLowerCase().replace(' ', '-') as MeetingPhase)}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300
                backdrop-blur-xl border
                ${salesContext.currentPhase === phase.toLowerCase().replace(' ', '-')
                  ? 'bg-white text-black border-transparent shadow-lg' 
                  : 'bg-[#1d1d1f]/50 text-white border-white/10 hover:bg-[#2d2d2f]/50'}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {phase}
            </motion.button>
          ))}
        </motion.div>

        {/* Main content area with refined styling */}
        <motion.div 
          className="rounded-2xl overflow-hidden bg-gradient-to-b from-[#1d1d1f] to-[#1d1d1f]/90 backdrop-blur-xl border border-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            {stream ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute top-0 left-0 w-full h-full"
              >
                <div className="h-[500px] w-[900px] justify-center items-center flex rounded-lg overflow-hidden" 
                     style={{ backgroundColor: "#121212" }}>
                  <video
                    ref={mediaStream}
                    autoPlay
                    playsInline
                    style={{ display: 'none' }}
                  >
                    <track kind="captions" />
                  </video>
                  <ChromaKeyVideo videoRef={mediaStream} />

                  {/* Control buttons with Apple-style design */}
                  <div className="absolute bottom-6 right-6 flex flex-col gap-3">
                    <motion.button
                      onClick={handleInterrupt}
                      className="px-6 py-2.5 rounded-full bg-white/10 backdrop-blur-xl
                        border border-white/20 text-white
                        hover:bg-white/20 transition-all duration-300 text-sm font-medium
                        shadow-lg"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Interrupt
                    </motion.button>
                    <motion.button
                      onClick={endSession}
                      className="px-6 py-2.5 rounded-full bg-[#ff453a] backdrop-blur-xl
                        text-white hover:bg-[#ff564f] transition-all duration-300
                        text-sm font-medium shadow-lg"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      End Session
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ) : !isLoadingSession ? (
              <motion.div 
                className="absolute top-0 left-0 w-full h-full flex items-center justify-center p-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="max-w-md w-full space-y-4">
                  <input
                    type="email"
                    placeholder="Enter prospect email"
                    value={prospectEmail}
                    onChange={(e) => setProspectEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full px-4 py-3 rounded-lg bg-[#2d2d2f] text-white border border-white/10
                      focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] transition-all duration-300
                      placeholder-white/40"
                  />
                  <motion.button
                    onClick={startSession}
                    disabled={!prospectEmail}
                    className="w-full bg-[#0071e3] text-white rounded-lg px-4 py-3 font-medium
                      hover:bg-[#0077ed] transition-all duration-300 disabled:opacity-50
                      disabled:hover:bg-[#0071e3]"
                    whileHover={{ scale: prospectEmail ? 1.02 : 1 }}
                    whileTap={{ scale: prospectEmail ? 0.98 : 1 }}
                  >
                    Start Session
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Spinner color="white" size="lg" />
                </motion.div>
              </div>
            )}
          </div>

          {/* Chat interface with refined styling */}
          {/* <div className="p-6 border-t border-white/10">
            <div className="relative">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type something for the avatar to respond"
                className="w-full px-4 py-3 rounded-lg bg-[#2d2d2f] text-white border border-white/10
                  focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] transition-all duration-300
                  placeholder-white/40"
              />
              <AnimatePresence>
                {text && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 
                      text-xs font-medium text-white/60"
                  >
                    Listening...
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div> */}
        </motion.div>

        {/* Debug console with refined styling */}
        {/* <AnimatePresence>
          {debug && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-4 text-xs font-mono text-white/60 text-right"
            >
              <span className="font-bold">Console:</span>
              <br />
              {debug}
            </motion.div>
          )}
        </AnimatePresence> */}
      </div>
    </div>
  );
}
