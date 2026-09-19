import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceRuntimeForRequest } from '@/lib/sandbox/workspace-runtime';

// GET: Retrieve current conversation state
export async function GET(request: NextRequest) {
  const runtime = getWorkspaceRuntimeForRequest(request);
  try {
    if (!runtime.conversationState) {
      return NextResponse.json({
        success: true,
        state: null,
        message: 'No active conversation'
      });
    }
    
    return NextResponse.json({
      success: true,
      state: runtime.conversationState
    });
  } catch (error) {
    console.error('[conversation-state] Error getting state:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

// POST: Reset or update conversation state
export async function POST(request: NextRequest) {
  const runtime = getWorkspaceRuntimeForRequest(request);
  try {
    const { action, data } = await request.json();
    
    switch (action) {
      case 'reset':
        runtime.conversationState = {
          conversationId: `conv-${Date.now()}`,
          startedAt: Date.now(),
          lastUpdated: Date.now(),
          context: {
            messages: [],
            edits: [],
            projectEvolution: { majorChanges: [] },
            userPreferences: {}
          }
        };
        
        console.log('[conversation-state] Reset conversation state');
        
        return NextResponse.json({
          success: true,
          message: 'Conversation state reset',
          state: runtime.conversationState
        });
        
      case 'clear-old':
        // Clear old conversation data but keep recent context
        if (!runtime.conversationState) {
          // Initialize conversation state if it doesn't exist
          runtime.conversationState = {
            conversationId: `conv-${Date.now()}`,
            startedAt: Date.now(),
            lastUpdated: Date.now(),
            context: {
              messages: [],
              edits: [],
              projectEvolution: { majorChanges: [] },
              userPreferences: {}
            }
          };
          
          console.log('[conversation-state] Initialized new conversation state for clear-old');
          
          return NextResponse.json({
            success: true,
            message: 'New conversation state initialized',
            state: runtime.conversationState
          });
        }
        
        // Keep only recent data
        runtime.conversationState.context.messages = runtime.conversationState.context.messages.slice(-5);
        runtime.conversationState.context.edits = runtime.conversationState.context.edits.slice(-3);
        runtime.conversationState.context.projectEvolution.majorChanges = 
          runtime.conversationState.context.projectEvolution.majorChanges.slice(-2);
        
        console.log('[conversation-state] Cleared old conversation data');
        
        return NextResponse.json({
          success: true,
          message: 'Old conversation data cleared',
          state: runtime.conversationState
        });
        
      case 'update':
        if (!runtime.conversationState) {
          return NextResponse.json({
            success: false,
            error: 'No active conversation to update'
          }, { status: 400 });
        }
        
        // Update specific fields if provided
        if (data) {
          if (data.currentTopic) {
            runtime.conversationState.context.currentTopic = data.currentTopic;
          }
          if (data.userPreferences) {
            runtime.conversationState.context.userPreferences = {
              ...runtime.conversationState.context.userPreferences,
              ...data.userPreferences
            };
          }
          
          runtime.conversationState.lastUpdated = Date.now();
        }
        
        return NextResponse.json({
          success: true,
          message: 'Conversation state updated',
          state: runtime.conversationState
        });
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use "reset" or "update"'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[conversation-state] Error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

// DELETE: Clear conversation state
export async function DELETE(request: NextRequest) {
  const runtime = getWorkspaceRuntimeForRequest(request);
  try {
    runtime.conversationState = null;
    
    console.log('[conversation-state] Cleared conversation state');
    
    return NextResponse.json({
      success: true,
      message: 'Conversation state cleared'
    });
  } catch (error) {
    console.error('[conversation-state] Error clearing state:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}