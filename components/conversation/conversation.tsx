'use client';

import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';
import React, { useContext, useEffect, useState, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { useCompany } from '@/components/interactive/useUser';
import { toast } from '@/components/layout/toast';
import { InteractiveConfigContext, Overrides } from '@/components/interactive/InteractiveConfigContext';
import { useConversations } from '@/components/interactive/useConversation';
import { Activity as ChatActivity } from '@/components/conversation/activity';
import Message from '@/components/conversation/Message/Message';
import { Badge, Check, Download, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { SidebarContent } from '@/components/layout/SidebarContentManager';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { ChatBar } from '@/components/conversation/input/chat-input';
import { Button } from '@/components/ui/button';

export type UIProps = {
  showSelectorsCSV?: string;
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
  alternateBackground?: 'primary' | 'secondary';
  footerMessage?: string;
  showOverrideSwitchesCSV?: string;
};

const conversationSWRPath = '/conversation/';

export function ChatSidebar({ currentConversation }: { currentConversation: any }): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const state = useContext(InteractiveConfigContext);
  const router = useRouter();
  // Add the sidebar state hook
  const { open, setOpen } = useSidebar('right');

  // Function to handle conversation deletion
  const handleDeleteConversation = async (): Promise<void> => {
    try {
      await state.agixt.deleteConversation(currentConversation?.id || '-');

      // Properly invalidate both the conversation list and the specific conversation cache
      await mutate('/conversations');
      await mutate(conversationSWRPath + state.overrides.conversation);

      // Update the state
      state.mutate((oldState) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: '-' },
      }));

      // Navigate to the main chat route
      router.push('/chat');

      toast({
        title: 'Success',
        description: 'Conversation deleted successfully',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        duration: 5000,
        variant: 'destructive',
      });
    }
  };

  // Track whether we expanded the sidebar for renaming
  const [wasExpanded, setWasExpanded] = useState(false);

  const handleRenameConversation = async (newName: string): Promise<void> => {
    try {
      // Make sure newName isn't empty
      if (!newName.trim()) {
        toast({
          title: 'Error',
          description: 'Conversation name cannot be empty',
          duration: 5000,
          variant: 'destructive',
        });
        return;
      }
      
      await state.agixt.renameConversation(getCookie('agixt-agent'), currentConversation?.id || '-', newName);

      // Properly invalidate both the conversation list and the specific conversation
      await mutate('/conversations');
      await mutate(conversationSWRPath + state.overrides.conversation);

      toast({
        title: 'Success',
        description: 'Conversation renamed successfully',
        duration: 3000,
      });

      // If we expanded the sidebar for renaming, collapse it again
      if (wasExpanded) {
        setOpen(false);
        setWasExpanded(false);
      }
    } catch (error) {
      console.error('Rename error:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename conversation',
        duration: 5000,
        variant: 'destructive',
      });
    }
  };

  const handleExportConversation = async (): Promise<void> => {
    try {
      // Get the full conversation content
      const conversationContent = await state.agixt.getConversation('', currentConversation?.id || '-');

      // Format the conversation for export
      const exportData = {
        name: currentConversation?.name || 'Conversation',
        id: currentConversation?.id || '-',
        created_at: currentConversation?.createdAt || new Date().toISOString(),
        messages: conversationContent.map((msg) => ({
          role: msg.role,
          content: msg.message,
          timestamp: msg.timestamp,
        })),
      };

      // Create and trigger download
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      element.href = URL.createObjectURL(file);
      element.download = `${currentConversation?.name || 'Conversation'}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(element.href);
      
      toast({
        title: 'Success',
        description: 'Conversation exported successfully',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export conversation',
        duration: 5000,
        variant: 'destructive',
      });
    }
  };
  
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (renaming) {
      setNewName(currentConversation?.name || '');
    }
  }, [renaming, currentConversation]);

  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  return (
    <SidebarContent title="Conversation">
      <SidebarGroup>
        {
          <div className='w-full group-data-[collapsible=icon]:hidden'>
            {renaming ? (
              <div className="flex items-center gap-2">
                <Input 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  className='w-full'
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameConversation(newName);
                      setRenaming(false);
                    } else if (e.key === 'Escape') {
                      setRenaming(false);
                    }
                  }}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    handleRenameConversation(newName);
                    setRenaming(false);
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h4 className="text-lg font-medium mb-2">{currentConversation?.name || 'New Conversation'}</h4>
            )}
            {currentConversation && currentConversation.attachmentCount > 0 && (
              <Badge className='gap-1 mb-2'>
                <Paperclip className='w-3 h-3' />
                {currentConversation.attachmentCount}
              </Badge>
            )}
          </div>
        }
        <SidebarGroupLabel>Conversation Actions</SidebarGroupLabel>
        <SidebarMenu>
          {[
            {
              title: 'New Conversation',
              icon: Plus,
              func: () => {
                router.push('/chat');
              },
              disabled: renaming,
            },
            {
              title: renaming ? 'Save Name' : 'Rename Conversation',
              icon: renaming ? Check : Pencil,
              func: renaming
                ? () => {
                    handleRenameConversation(newName);
                    setRenaming(false);
                  }
                : () => {
                    // First ensure the sidebar is open
                    if (!open) {
                      // Track that we expanded the sidebar
                      setWasExpanded(true);
                      setOpen(true);
                      // Allow time for sidebar animation before enabling rename mode
                      setTimeout(() => {
                        setRenaming(true);
                        setNewName(currentConversation?.name || '');
                      }, 300);
                    } else {
                      // Sidebar is already open, directly enter rename mode
                      setRenaming(true);
                      setNewName(currentConversation?.name || '');
                    }
                  },
              disabled: false,
            },
            {
              title: 'Export Conversation',
              icon: Download,
              func: () => handleExportConversation(),
              disabled: renaming || !currentConversation?.id || currentConversation?.id === '-',
            },
            {
              title: 'Delete Conversation',
              icon: Trash2,
              func: () => setDeleteDialogOpen(true),
              disabled: renaming || !currentConversation?.id || currentConversation?.id === '-',
            },
          ].map(
            (item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton side='right' tooltip={item.title} onClick={item.func} disabled={item.disabled}>
                  {item.icon && <item.icon className="h-4 w-4" />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ),
          )}
        </SidebarMenu>
      </SidebarGroup>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                handleDeleteConversation();
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarContent>
  );
}

export function ChatLog({
  conversation,
  alternateBackground,
  loading,
  setLoading,
}: {
  conversation: { role: string; message: string; timestamp: string; children: any[] }[];
  setLoading: (loading: boolean) => void;
  loading: boolean;
  alternateBackground?: string;
}): React.JSX.Element {
  let lastUserMessage = ''; // track the last user message
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  return (
    <div className='flex flex-col-reverse flex-grow overflow-auto bg-background pb-28' style={{ flexBasis: '0px' }}>
      <div className='flex flex-col h-min'>
        {conversation.length > 0 && conversation.map ? (
          conversation.map((chatItem, index: number) => {
            if (chatItem.role === 'user') {
              lastUserMessage = chatItem.message;
            }
            const validTypes = [
              '[ACTIVITY]',
              '[ACTIVITY][ERROR]',
              '[ACTIVITY][WARN]',
              '[ACTIVITY][INFO]',
              '[SUBACTIVITY]',
              '[SUBACTIVITY][THOUGHT]',
              '[SUBACTIVITY][REFLECTION]',
              '[SUBACTIVITY][EXECUTION]',
              '[SUBACTIVITY][ERROR]',
              '[SUBACTIVITY][WARN]',
              '[SUBACTIVITY][INFO]',
            ];
            const messageType = chatItem.message.split(' ')[0];
            const messageBody = validTypes.some((x) => messageType.includes(x))
              ? chatItem.message.substring(chatItem.message.indexOf(' '))
              : chatItem.message;
            
            return validTypes.includes(messageType) ? (
              <ChatActivity
                key={chatItem.timestamp + '-' + messageBody}
                activityType={
                  messageType === '[ACTIVITY]'
                    ? 'success'
                    : (messageType.split('[')[2]?.split(']')[0]?.toLowerCase() as
                        | 'error'
                        | 'info'
                        | 'success'
                        | 'warn'
                        | 'thought'
                        | 'reflection'
                        | 'execution'
                        | 'diagram')
                }
                nextTimestamp={conversation[index + 1]?.timestamp}
                message={messageBody}
                timestamp={chatItem.timestamp}
                alternateBackground={alternateBackground}
                children={chatItem.children}
              />
            ) : (
              <Message
                key={chatItem.timestamp + '-' + messageBody}
                chatItem={chatItem}
                lastUserMessage={lastUserMessage}
                setLoading={setLoading}
              />
            );
          })
        ) : (
          <div className='max-w-4xl px-2 mx-auto space-y-4 text-center mt-8'>
            <div>
              <h1 className='text-4xl md:text-6xl font-bold mb-4'>
                Welcome {process.env.NEXT_PUBLIC_APP_NAME && `to ${process.env.NEXT_PUBLIC_APP_NAME}`}
              </h1>
              {process.env.NEXT_PUBLIC_APP_DESCRIPTION && (
                <p className='text-lg text-muted-foreground'>{process.env.NEXT_PUBLIC_APP_DESCRIPTION}</p>
              )}
            </div>
            <p className='text-muted-foreground'>Start a conversation by typing a message below</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export async function getAndFormatConversation(state): Promise<any[]> {
  const rawConversation = await state.agixt.getConversation('', state.overrides.conversation, 100, 1);

  // Create a map of activity messages for faster lookups
  const activityMessages = {};
  const formattedConversation = [];

  // First pass: identify and store all activities
  rawConversation.forEach((message) => {
    const messageType = message.message.split(' ')[0];
    if (!messageType.startsWith('[SUBACTIVITY]')) {
      formattedConversation.push({ ...message, children: [] });
      activityMessages[message.id] = formattedConversation[formattedConversation.length - 1];
    }
  });

  // Second pass: handle subactivities
  rawConversation.forEach((currentMessage) => {
    const messageType = currentMessage.message.split(' ')[0];
    if (messageType.startsWith('[SUBACTIVITY]')) {
      try {
        // Try to extract parent ID
        const parent = messageType.split('[')[2].split(']')[0];
        let foundParent = false;

        // Look for the parent in our activity map
        if (activityMessages[parent]) {
          activityMessages[parent].children.push({ ...currentMessage, children: [] });
          foundParent = true;
        } else {
          // If no exact match, try to find it in children
          for (const activity of formattedConversation) {
            const targetInChildren = activity.children.find((child) => child.id === parent);
            if (targetInChildren) {
              targetInChildren.children.push({ ...currentMessage, children: [] });
              foundParent = true;
              break;
            }
          }
        }

        // If still not found, add to the last activity as a fallback
        if (!foundParent && formattedConversation.length > 0) {
          const lastActivity = formattedConversation[formattedConversation.length - 1];
          lastActivity.children.push({ ...currentMessage, children: [] });
        }
      } catch (error) {
        // If parsing fails, add to the last activity as a fallback
        if (formattedConversation.length > 0) {
          const lastActivity = formattedConversation[formattedConversation.length - 1];
          lastActivity.children.push({ ...currentMessage, children: [] });
        } else {
          // If no activities exist yet, convert this subactivity to an activity
          formattedConversation.push({ ...currentMessage, children: [] });
        }
      }
    }
  });

  return formattedConversation;
}

export function Chat({
  alternateBackground,
  enableFileUpload,
  enableVoiceInput,
  showOverrideSwitchesCSV,
  conversation: conversationOverride,
}: Overrides & UIProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const state = useContext(InteractiveConfigContext);
  const { data: conversations, isLoading: isLoadingConversations } = useConversations();
  const router = useRouter();

  // Find the current conversation
  const currentConversation = conversations?.find((conv) => conv.id === state.overrides.conversation);
  const conversation = useSWR(
    conversationSWRPath + state.overrides.conversation,
    async () => {
      return await getAndFormatConversation(state);
    },
    {
      fallbackData: [],
      refreshInterval: loading ? 1000 : 0,
    },
  );
  
  // Check if the conversation is empty
  const isEmptyConversation = conversation.data?.length === 0;
  
  const { data: activeCompany } = useCompany();
  
  useEffect(() => {
    if (Array.isArray(state.overrides.conversation)) {
      state.mutate((oldState) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: oldState.overrides.conversation[0] },
      }));
    }
  }, [state.overrides.conversation]);
  
  async function chat(messageTextBody, messageAttachedFiles): Promise<string> {
    const messages = [];

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: messageTextBody },
        ...Object.entries(messageAttachedFiles).map(([fileName, fileContent]: [string, string]) => ({
          type: `${fileContent.split(':')[1].split('/')[0]}_url`,
          file_name: fileName,
          [`${fileContent.split(':')[1].split('/')[0]}_url`]: {
            url: fileContent,
          },
        })),
      ],
      ...(activeCompany?.id ? { company_id: activeCompany?.id } : {}),
      ...(getCookie('agixt-create-image') ? { create_image: getCookie('agixt-create-image') } : {}),
      ...(getCookie('agixt-tts') ? { tts: getCookie('agixt-tts') } : {}),
      ...(getCookie('agixt-websearch') ? { websearch: getCookie('agixt-websearch') } : {}),
      ...(getCookie('agixt-analyze-user-input') ? { analyze_user_input: getCookie('agixt-analyze-user-input') } : {}),
    });

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    mutate(conversationSWRPath + state.overrides.conversation);
    try {
      const completionResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        {
          messages: messages,
          model: getCookie('agixt-agent'),
          user: state.overrides.conversation,
        },
        {
          headers: {
            Authorization: getCookie('jwt'),
          },
        },
      );
      if (completionResponse.status === 200) {
        const chatCompletion = completionResponse.data;

        // Store conversation ID
        const conversationId = chatCompletion.id;

        // Update conversation state
        state.mutate((oldState) => ({
          ...oldState,
          overrides: {
            ...oldState.overrides,
            conversation: conversationId,
          },
        }));

        // Push route after state is updated
        router.push(`/chat/${conversationId}`);

        // Refresh data after updating conversation
        setLoading(false);

        // Trigger proper mutations
        mutate(conversationSWRPath + conversationId);
        mutate('/conversations');
        mutate('/user');

        if (chatCompletion?.choices[0]?.message.content.length > 0) {
          return chatCompletion.choices[0].message.content;
        } else {
          throw new Error('Failed to get response from the agent');
        }
      } else {
        throw new Error('Failed to get response from the agent');
      }
    } catch (error) {
      setLoading(false);
      toast({
        title: 'Error',
        description: 'Failed to get response from the agent',
        duration: 5000,
        variant: 'destructive',
      });
      return '';
    }
  }

  useEffect(() => {
    mutate(conversationSWRPath + state.overrides.conversation);
  }, [state.overrides.conversation]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        mutate(conversationSWRPath + state.overrides.conversation);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, state.overrides.conversation]);

  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  return (
    <>
      <ChatSidebar currentConversation={currentConversation} />
      <ChatLog
        conversation={conversation.data}
        alternateBackground={alternateBackground}
        setLoading={setLoading}
        loading={loading}
      />
      <ChatBar
        onSend={chat}
        disabled={loading}
        enableFileUpload={enableFileUpload}
        enableVoiceInput={enableVoiceInput}
        loading={loading}
        setLoading={setLoading}
        showOverrideSwitchesCSV={showOverrideSwitchesCSV}
        showResetConversation={false}
        isEmptyConversation={isEmptyConversation}
      />
    </>
  );
}