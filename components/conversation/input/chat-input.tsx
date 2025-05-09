'use client';

import React, { ReactNode, useContext, useState, useRef, useEffect } from 'react';
import { BiCollapseVertical } from 'react-icons/bi';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
import { VoiceRecorder } from '@/components/conversation/input/VoiceRecorder';
import { Textarea } from '@/components/ui/textarea';
import { DropZone } from '@/components/conversation/input/DropZone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle as LuCheckCircle, UploadCloud } from 'lucide-react';
import { LuPaperclip, LuSend, LuArrowUp, LuLoader, LuTrash2 } from 'react-icons/lu';
import { Tooltip, TooltipBasic, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { deleteCookie, getCookie, setCookie } from 'cookies-next';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/layout/toast';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';

export function OverrideSwitch({ name, label }: { name: string; label: string }): React.JSX.Element {
  const [state, setState] = useState<boolean | null>(
    getCookie('agixt-' + name) === undefined ? null : getCookie('agixt-' + name) !== 'false',
  );
  useEffect(() => {
    if (state === null) {
      deleteCookie('agixt-' + name, { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN });
    } else {
      setCookie('agixt-' + name, state.toString(), {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
        maxAge: 2147483647,
      });
    }
  }, [state, name]);
  return (
    <div className='flex flex-col items-center gap-1'>
      <span className='text-lg'>{label}</span>
      <div className='flex items-center gap-2'>
        <Checkbox checked={state === null} onClick={() => setState((old) => (old === null ? false : null))} />
        <p>Use Default</p>
      </div>
      {state !== null && (
        <TooltipBasic title={label}>
          <div className='flex flex-row items-center space-x-2'>
            <p>{state === null ? null : state ? 'Allowed' : 'Never'}</p>
            <Switch id={label} checked={state} onClick={() => setState((old) => !old)} />
          </div>
        </TooltipBasic>
      )}
    </div>
  );
}

export const Timer = ({ loading, timer }: { loading: boolean; timer: number }) => {
  const tooltipMessage = loading
    ? `Your most recent interaction has been underway (including all activities) for ${(timer / 10).toFixed(1)} seconds.`
    : `Your last interaction took ${(timer / 10).toFixed(1)} seconds to completely resolve.`;

  return (
    <TooltipBasic title={tooltipMessage} side='left'>
      <div className='flex items-center space-x-1'>
        <span className='text-sm'>{(timer / 10).toFixed(1)}s</span>
        {loading ? <LuLoader className='animate-spin' /> : <LuCheckCircle className='text-green-500' />}
      </div>
    </TooltipBasic>
  );
};

export const OverrideSwitches = ({ showOverrideSwitches }: { showOverrideSwitches: string }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size='icon' variant='ghost' className='rounded-full'>
          <LuArrowUp className='w-5 h-5' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-56'>
        <div className='space-y-4'>
          {showOverrideSwitches.split(',').includes('tts') && <OverrideSwitch name='tts' label='Text-to-Speech' />}
          {showOverrideSwitches.split(',').includes('websearch') && <OverrideSwitch name='websearch' label='Websearch' />}
          {showOverrideSwitches.split(',').includes('create-image') && (
            <OverrideSwitch name='create-image' label='Generate an Image' />
          )}
          {showOverrideSwitches.split(',').includes('analyze-user-input') && (
            <OverrideSwitch name='analyze-user-input' label='Analyze' />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const UploadFiles = ({ handleUploadFiles, message, uploadedFiles, disabled }: any) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <>
            <Button
              size='icon'
              variant='ghost'
              className='rounded-full'
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <LuPaperclip className='w-5 h-5 ' />
            </Button>
            <label id='trigger-file-upload' htmlFor='file-upload' className='hidden'>
              Upload files
            </label>
            <input
              id='file-upload'
              type='file'
              multiple
              className='hidden'
              onChange={handleUploadFiles}
              disabled={disabled}
            />
          </>
        </TooltipTrigger>
        <TooltipContent>Upload Files</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Import Conversation Dialog component
export const ImportConversation = () => {
  const state = useContext(InteractiveConfigContext);
  const router = useRouter();
  const [importMethod, setImportMethod] = useState<'file' | 'link'>('file');
  const [conversationLink, setConversationLink] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    try {
      const file = event.target.files[0];
      const fileName = file.name.replace(/\.[^/.]+$/, '');

      // Read the file content
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Parse the JSON content
          const content = JSON.parse(e.target.result as string);

          // Use the name from the JSON if available, otherwise use filename
          const baseName = content.name || fileName;
          const timestamp = new Date().toISOString().split('.')[0].replace(/:/g, '-');
          const conversationName = `${baseName}_${timestamp}`;

          // Format the conversation content
          let conversationContent = [];
          if (content.messages && Array.isArray(content.messages)) {
            conversationContent = content.messages.map((msg) => ({
              role: msg.role || 'user',
              message: msg.content || msg.message || '',
              timestamp: msg.timestamp || new Date().toISOString(),
            }));
          } else if (content.conversation_history && Array.isArray(content.conversation_history)) {
            conversationContent = content.conversation_history.map((msg) => ({
              role: msg.role || 'user',
              message: msg.message || msg.content || '',
              timestamp: msg.timestamp || new Date().toISOString(),
            }));
          }

          // Check if there are any messages to import
          if (conversationContent.length === 0) {
            throw new Error('No valid conversation messages found in the imported file');
          }

          // Create the new conversation
          const newConversation = await state.agixt.newConversation(state.agent, conversationName, conversationContent);
          const newConversationID = newConversation.id || '-';
          
          // Update the conversation list and navigate to the new conversation
          await mutate('/conversations');

          // Set the new conversation as active
          state.mutate((oldState) => ({
            ...oldState,
            overrides: { ...oldState.overrides, conversation: conversationName },
          }));

          // Navigate to the new conversation
          router.push(`/chat/${newConversationID}`);

          toast({
            title: 'Success',
            description: 'Conversation imported successfully',
            duration: 3000,
          });
          
          setIsDialogOpen(false);
        } catch (error) {
          console.error('Error processing file:', error);
          toast({
            title: 'Error',
            description: `Failed to process the imported conversation file: ${error.message || 'Unknown error'}`,
            duration: 5000,
            variant: 'destructive',
          });
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Error importing conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to import conversation',
        duration: 5000,
        variant: 'destructive',
      });
    }
  };

  const handleImportLink = async () => {
    if (!conversationLink.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a valid conversation link',
        duration: 3000,
        variant: 'destructive',
      });
      return;
    }

    try {
      // Extract conversation ID from link
      const urlObj = new URL(conversationLink);
      const pathParts = urlObj.pathname.split('/');
      const conversationId = pathParts[pathParts.length - 1];

      if (!conversationId) {
        throw new Error('Invalid conversation link');
      }

      // Navigate to the conversation
      router.push(`/chat/${conversationId}`);
      
      // Update the state
      state.mutate((oldState) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: conversationId },
      }));

      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid conversation link format',
        duration: 3000,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size='icon'
                variant='ghost'
                className='rounded-full'
                onClick={() => setIsDialogOpen(true)}
              >
                <UploadCloud className='w-5 h-5' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import Conversation</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Conversation</DialogTitle>
          <DialogDescription>
            Import a conversation from a file
          </DialogDescription>
        </DialogHeader>
        
        <div className='flex space-x-4 my-4'>
          <Button 
            variant={importMethod === 'file' ? 'default' : 'outline'} 
            onClick={() => setImportMethod('file')}
            className='flex-1'
          >
            From File
          </Button>
          <Button 
            variant={importMethod === 'link' ? 'default' : 'outline'} 
            onClick={() => setImportMethod('link')}
            className='flex-1 disabled hidden'
          >
            From Link
          </Button>
        </div>

        {importMethod === 'file' ? (
          <div className='space-y-4'>
            <div className='grid w-full max-w-sm items-center gap-1.5'>
              <Label htmlFor='import-file'>Choose conversation file</Label>
              <Input 
                id='import-file' 
                type='file' 
                accept='.json'
                onChange={handleImportFile}
              />
            </div>
            <p className='text-sm text-muted-foreground'>
              Select a JSON file containing conversation data to import
            </p>
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='grid w-full max-w-sm items-center gap-1.5'>
              <Label htmlFor='conversation-link'>Conversation Link</Label>
              <Input 
                id='conversation-link' 
                placeholder='https://chat.yourdomain.com/chat/conversation-id'
                value={conversationLink}
                onChange={(e) => setConversationLink(e.target.value)}
              />
            </div>
            <Button onClick={handleImportLink}>Import from Link</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const SendMessage = ({ handleSend, message, uploadedFiles, disabled }: any) => {
  return (
    <TooltipBasic title='Send Message' side='left'>
      <Button
        id='send-message'
        onClick={(event) => {
          event.preventDefault();
          handleSend(message, uploadedFiles);
        }}
        disabled={(message.trim().length === 0 && Object.keys(uploadedFiles).length === 0) || disabled}
        size='icon'
        variant='ghost'
        className='rounded-full'
      >
        <LuSend className='w-5 h-5' />
      </Button>
    </TooltipBasic>
  );
};

export const ResetConversation = ({ state, setCookie }: any) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='outline' size='icon'>
          <LuTrash2 className='w-4 h-4' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Conversation</DialogTitle>
          <DialogDescription>Are you sure you want to reset the conversation? This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => {
              const uuid = crypto.randomUUID();
              setCookie('uuid', uuid, { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN, maxAge: 2147483647 });
              state.mutate((oldState: any) => ({
                ...oldState,
                overrides: { ...oldState.overrides, conversation: uuid },
              }));
            }}
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ListUploadedFiles = ({ uploadedFiles, setUploadedFiles }: any): ReactNode => {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <span className='text-sm text-muted-foreground'>Uploaded Files:</span>
      {Object.entries(uploadedFiles).map(([fileName]) => (
        <Badge
          key={fileName}
          variant='outline'
          className='py-1 cursor-pointer bg-muted'
          onClick={() => {
            setUploadedFiles((prevFiles: any) => {
              const newFiles = { ...prevFiles };
              delete newFiles[String(fileName)];
              return newFiles;
            });
          }}
        >
          {fileName}
        </Badge>
      ))}
    </div>
  );
};

export function ChatBar({
  onSend,
  disabled,
  loading,
  setLoading,
  clearOnSend = true,
  blurOnSend = true,
  enableFileUpload = false,
  enableVoiceInput = false,
  showResetConversation = false,
  showOverrideSwitchesCSV = '',
  isEmptyConversation = false,
}: {
  onSend: (message: string | object, uploadedFiles?: { [x: string]: string }) => Promise<string>;
  disabled: boolean;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  clearOnSend?: boolean;
  blurOnSend?: boolean;
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
  showResetConversation?: boolean;
  showOverrideSwitchesCSV?: string;
  isEmptyConversation?: boolean;
}): ReactNode {
  const state = useContext(InteractiveConfigContext);
  const [timer, setTimer] = useState<number>(-1);
  const [uploadedFiles, setUploadedFiles] = useState<{ [x: string]: string }>({});
  const [alternativeInputActive, setAlternativeInputActive] = useState(false);
  const {
    textareaRef,
    isActive,
    handleFocus,
    handleBlur,
    value: message,
    setValue: setMessage,
    setIsActive,
  } = useDynamicInput('', uploadedFiles);

  const handleUploadFiles = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    if (event.target.files) {
      for (const file of event.target.files) {
        await uploadFile(file);
      }
    }
  };

  const uploadFile = async (file: File) => {
    const newUploadedFiles: { [x: string]: string } = {};
    const fileContent = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = (): void => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    newUploadedFiles[file.name] = fileContent;
    setUploadedFiles((previous) => ({ ...previous, ...newUploadedFiles }));
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setTimer(0);
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 100);
    }
    return () => {
      clearInterval(interval);
    };
  }, [loading]);

  return (
    <DropZone
      onUpload={(files: File[]) => files.map((file) => uploadFile(file))}
      className={cn(
        'flex absolute bg-background bottom-0 items-center left-0 right-0 max-w-[95%] px-2 m-3 mx-auto border overflow-hidden shadow-md rounded-3xl',
        isActive && 'flex-col p-1',
      )}
    >
      {isActive ? (
        <label className='w-full' htmlFor='message'>
          <div className='w-full'>
            <Textarea
              ref={textareaRef}
              placeholder={loading ? 'Sending...' : 'Enter your message here...'}
              className='overflow-x-hidden overflow-y-auto border-none resize-none min-h-4 ring-0 focus-visible:ring-0 max-h-96'
              rows={1}
              name='message'
              id='message'
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={async (event) => {
                if (event.key === 'Enter' && !event.shiftKey && message) {
                  event.preventDefault();
                  if (blurOnSend) {
                    handleBlur();
                  }

                  await onSend(message, uploadedFiles);
                  if (clearOnSend) {
                    setMessage('');
                    setUploadedFiles({});
                  }
                }
              }}
              disabled={disabled}
            />
          </div>
          <div className='flex items-center w-full gap-1'>
            {enableFileUpload && !alternativeInputActive && (
              <UploadFiles
                handleUploadFiles={handleUploadFiles}
                message={message}
                uploadedFiles={uploadedFiles}
                disabled={disabled}
              />
            )}
            {isEmptyConversation && <ImportConversation />}
            {Object.keys(uploadedFiles).length > 0 && (
              <ListUploadedFiles uploadedFiles={uploadedFiles} setUploadedFiles={setUploadedFiles} />
            )}
            <div className='flex-grow' />
            <TooltipBasic title='Collapse Input' side='top'>
              <Button size='icon' variant='ghost' className='rounded-full' onClick={() => setIsActive(false)}>
                <BiCollapseVertical className='w-4 h-4' />
              </Button>
            </TooltipBasic>
            {enableVoiceInput && <VoiceRecorder onSend={onSend} disabled={disabled} />}
            {showResetConversation && <ResetConversation state={state} setCookie={setCookie} />}
            {!alternativeInputActive && (
              <SendMessage
                handleSend={() => {
                  if (blurOnSend) {
                    handleBlur();
                  }
                  if (clearOnSend) {
                    setMessage('');
                    setUploadedFiles({});
                  }
                  onSend(message, uploadedFiles);
                }}
                message={message}
                uploadedFiles={uploadedFiles}
                disabled={disabled}
              />
            )}
          </div>
        </label>
      ) : (
        <>
          {enableFileUpload && !alternativeInputActive && (
            <UploadFiles
              handleUploadFiles={handleUploadFiles}
              message={message}
              uploadedFiles={uploadedFiles}
              disabled={disabled}
            />
          )}
          {isEmptyConversation && <ImportConversation />}
          <Button
            id='message'
            size='lg'
            role='textbox'
            variant='ghost'
            className='justify-start w-full px-4 hover:bg-transparent'
            onClick={handleFocus}
          >
            <span className='font-light text-muted-foreground'>{loading ? 'Sending...' : 'Enter your message here...'}</span>
          </Button>
          {enableVoiceInput && <VoiceRecorder onSend={onSend} disabled={disabled} />}
        </>
      )}
    </DropZone>
  );
}

export function useDynamicInput(initialValue = '', uploadedFiles: { [x: string]: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isActive) return;

    const adjustHeight = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    textarea.addEventListener('input', adjustHeight);
    adjustHeight();

    return () => textarea.removeEventListener('input', adjustHeight);
  }, [isActive]);

  useEffect(() => {
    if (Object.keys(uploadedFiles).length > 0) {
      setIsActive(true);
    }
  }, [uploadedFiles]);

  const handleFocus = () => {
    setIsActive(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    setValue('');
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'unset';
    }
  };

  return { textareaRef, isActive, setIsActive, handleFocus, handleBlur, value, setValue };
}
