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

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";

import {AVATARS, STT_LANGUAGE_LIST} from "@/app/lib/constants";
import { ProspectInfo, MeetingSummary, SalesContext } from "@/app/types/sales";

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
      setIsUserTalking(true);
    });
    avatar.current?.on(StreamingEvents.USER_STOP, (event) => {
      console.log(">>>>> User stopped talking:", event);
      setIsUserTalking(false);
    });
    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Medium,
        avatarName: "Anna_public_3_20240108",
        voice: {
          rate: 1.2,
          emotion: VoiceEmotion.FRIENDLY,
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
    await avatar.current.speak({ text: text, taskType: TaskType.REPEAT, taskMode: TaskMode.SYNC }).catch((e) => {
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

  async function handlePhaseChange(newPhase: 'briefing' | 'meeting' | 'summary') {
    if (!avatar.current) return;

    setSalesContext(prev => ({ ...prev, currentPhase: newPhase }));
    
    let message = '';
    switch (newPhase) {
      case 'briefing':
        if (prospectInfo) {
          message = `Let me brief you about ${prospectInfo.name} from ${prospectInfo.company}. 
          They are the ${prospectInfo.position} and their main pain points are ${prospectInfo.painPoints.join(', ')}. 
          Previous interactions: ${prospectInfo.previousInteractions.join(', ')}.`;
        }
        break;
      
      case 'meeting':
        message = "You mentioned one of our competitors - Hooli - earlier. Could you tell me more about your experience with them and what specific aspects made you consider alternatives?";
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

    if (message) {
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
    <div className="w-full min-h-screen bg-[#000000] text-white">
      {/* Phase indicator */}
      <div className="max-w-7xl mx-auto py-8">
        <div className="flex justify-center gap-4 mb-12">
          {['Briefing', 'Meeting', 'Summary'].map((phase) => (
            <button
              key={phase}
              onClick={() => handlePhaseChange(phase.toLowerCase() as any)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all
                ${salesContext.currentPhase === phase.toLowerCase() 
                  ? 'bg-white text-black' 
                  : 'bg-[#1d1d1f] text-white hover:bg-[#2d2d2f]'}`}
            >
              {phase}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="rounded-2xl overflow-hidden bg-[#1d1d1f] mb-8">
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            {stream ? (
              <video
                ref={mediaStream}
                autoPlay
                playsInline
                className="absolute top-0 left-0 w-full h-full object-contain bg-[#00ff00]"
              >
                <track kind="captions" />
              </video>
            ) : !isLoadingSession ? (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center p-8">
                <div className="max-w-md w-full">
                  <input
                    type="email"
                    placeholder="Enter prospect email"
                    value={prospectEmail}
                    onChange={(e) => setProspectEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full px-4 py-3 rounded-lg bg-[#2d2d2f] text-white border-none mb-4"
                  />
                  <button
                    onClick={startSession}
                    disabled={!prospectEmail}
                    className="w-full bg-[#0071e3] text-white rounded-lg px-4 py-3 font-medium
                      hover:bg-[#0077ed] transition-colors disabled:opacity-50"
                  >
                    Start Session
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                <Spinner color="white" size="lg" />
              </div>
            )}

            {/* Control buttons */}
            {stream && (
              <div className="absolute bottom-6 right-6 flex flex-col gap-3">
                <button
                  onClick={handleInterrupt}
                  className="px-6 py-2 rounded-full bg-white/10 backdrop-blur-md
                    hover:bg-white/20 transition-colors text-sm font-medium"
                >
                  Interrupt
                </button>
                <button
                  onClick={endSession}
                  className="px-6 py-2 rounded-full bg-red-500/80 backdrop-blur-md
                    hover:bg-red-500 transition-colors text-sm font-medium"
                >
                  End Session
                </button>
              </div>
            )}
          </div>

          {/* Chat interface */}
          <div className="p-6 border-t border-[#2d2d2f]">
            <div className="flex gap-4 mb-4">
              {['Text Mode', 'Voice Mode'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleChangeChatMode(mode.toLowerCase().replace(' ', '_'))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${chatMode === mode.toLowerCase().replace(' ', '_')
                      ? 'bg-white text-black'
                      : 'bg-[#2d2d2f] text-white hover:bg-[#3d3d3f]'}`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {chatMode === "text_mode" ? (
              <div className="relative">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type something for the avatar to respond"
                  className="w-full px-4 py-3 rounded-lg bg-[#2d2d2f] text-white border-none"
                />
                {text && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 
                    text-xs font-medium text-white/60">
                    Listening...
                  </span>
                )}
              </div>
            ) : (
              <div className="text-center">
                <button
                  disabled={!isUserTalking}
                  className={`px-6 py-2 rounded-full ${
                    isUserTalking
                      ? 'bg-[#0071e3] text-white'
                      : 'bg-[#2d2d2f] text-white/60'
                  }`}
                >
                  {isUserTalking ? "Listening..." : "Voice Chat"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Debug console */}
        {debug && (
          <div className="text-xs font-mono text-white/60 text-right">
            <span className="font-bold">Console:</span>
            <br />
            {debug}
          </div>
        )}
      </div>
    </div>
  );
}
