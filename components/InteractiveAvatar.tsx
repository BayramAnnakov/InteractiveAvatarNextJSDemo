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
    <div className="w-full flex flex-col gap-4">
      <div className="w-full mb-4">
        <Chip 
          color={salesContext.currentPhase === 'briefing' ? 'primary' : 'default'}
          className="mr-2"
        >
          Briefing
        </Chip>
        <Chip 
          color={salesContext.currentPhase === 'meeting' ? 'primary' : 'default'}
          className="mr-2"
        >
          Meeting
        </Chip>
        <Chip 
          color={salesContext.currentPhase === 'summary' ? 'primary' : 'default'}
        >
          Summary
        </Chip>
      </div>
      <Card>
        <CardBody className="h-[500px] flex flex-col justify-center items-center">
          {stream ? (
            <div className="h-[500px] w-[900px] justify-center items-center flex rounded-lg overflow-hidden">
              <video
                ref={mediaStream}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              >
                <track kind="captions" />
              </video>
              <div className="flex flex-col gap-2 absolute bottom-3 right-3">
                <div className="flex flex-col gap-2 mb-4">
                  <Button
                    className="bg-gradient-to-tr from-blue-500 to-blue-300 text-white rounded-lg"
                    size="sm"
                    variant="shadow"
                    isDisabled={salesContext.currentPhase === 'briefing'}
                    onClick={() => handlePhaseChange('briefing')}
                  >
                    Switch to Briefing
                  </Button>
                  <Button
                    className="bg-gradient-to-tr from-green-500 to-green-300 text-white rounded-lg"
                    size="sm"
                    variant="shadow"
                    isDisabled={salesContext.currentPhase === 'meeting'}
                    onClick={() => handlePhaseChange('meeting')}
                  >
                    Switch to Meeting
                  </Button>
                  <Button
                    className="bg-gradient-to-tr from-purple-500 to-purple-300 text-white rounded-lg"
                    size="sm"
                    variant="shadow"
                    isDisabled={salesContext.currentPhase === 'summary'}
                    onClick={() => handlePhaseChange('summary')}
                  >
                    Switch to Summary
                  </Button>
                </div>
                <Button
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={handleInterrupt}
                >
                  Interrupt task
                </Button>
                <Button
                  className="bg-gradient-to-tr from-red-500 to-red-300 text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={endSession}
                >
                  End session
                </Button>
              </div>
            </div>
          ) : !isLoadingSession ? (
            <div className="h-full justify-center items-center flex flex-col gap-8 w-[500px] self-center">
              <div className="flex flex-col gap-4 w-full">
                <div>
                  <p className="text-sm font-medium leading-none mb-2">
                    Prospect Email
                  </p>
                  <Input
                    placeholder="Enter prospect email"
                    value={prospectEmail}
                    onChange={(e) => setProspectEmail(e.target.value)}
                    onKeyPress={handleKeyPress}
                    type="email"
                  />
                </div>
                <Button
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 w-full text-white"
                  size="md"
                  variant="shadow"
                  onClick={startSession}
                  isDisabled={!prospectEmail}
                >
                  Start session
                </Button>
              </div>
            </div>
          ) : (
            <Spinner color="default" size="lg" />
          )}
        </CardBody>
        <Divider />
        <CardFooter className="flex flex-col gap-3 relative">
          <Tabs
            aria-label="Options"
            selectedKey={chatMode}
            onSelectionChange={(v) => {
              handleChangeChatMode(v);
            }}
          >
            <Tab key="text_mode" title="Text mode" />
            <Tab key="voice_mode" title="Voice mode" />
          </Tabs>
          {chatMode === "text_mode" ? (
            <div className="w-full flex relative">
              <InteractiveAvatarTextInput
                disabled={!stream}
                input={text}
                label="Chat"
                loading={isLoadingRepeat}
                placeholder="Type something for the avatar to respond"
                setInput={setText}
                onSubmit={handleSpeak}
              />
              {text && (
                <Chip className="absolute right-16 top-3">Listening</Chip>
              )}
            </div>
          ) : (
            <div className="w-full text-center">
              <Button
                isDisabled={!isUserTalking}
                className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white"
                size="md"
                variant="shadow"
              >
                {isUserTalking ? "Listening" : "Voice chat"}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
      <p className="font-mono text-right">
        <span className="font-bold">Console:</span>
        <br />
        {debug}
      </p>
    </div>
  );
}
