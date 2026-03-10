/**
 * Channels State Store
 * Manages messaging channel state
 */
import { create } from 'zustand';
import { hostApiFetch } from '@/lib/host-api';
import { invokeIpc } from '@/lib/api-client';
import { useGatewayStore } from './gateway';
import type { Channel, ChannelType } from '../types/channel';

interface AddChannelParams {
  type: ChannelType;
  name: string;
  token?: string;
}

export interface ChannelBinding {
  channelType: string;
  agentId: string;
  accountId?: string;
}

interface ChannelsState {
  channels: Channel[];
  /** Channel–agent bindings: which agent handles which channel */
  bindings: ChannelBinding[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchChannels: () => Promise<void>;
  addChannel: (params: AddChannelParams) => Promise<Channel>;
  deleteChannel: (channelId: string) => Promise<void>;
  connectChannel: (channelId: string) => Promise<void>;
  disconnectChannel: (channelId: string) => Promise<void>;
  requestQrCode: (channelType: ChannelType) => Promise<{ qrCode: string; sessionId: string }>;
  setChannels: (channels: Channel[]) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  clearError: () => void;
  /** Load channel–agent bindings from config */
  fetchBindings: () => Promise<void>;
  /** Set or update a channel–agent binding */
  setBinding: (channelType: string, agentId: string | null, accountId?: string) => Promise<void>;
  /** Get the bound agent ID for a channel type (optionally per account) */
  getBindingAgent: (channelType: string, accountId?: string) => string | undefined;
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: [],
  bindings: [],
  loading: false,
  error: null,

  fetchChannels: async () => {
    set({ loading: true, error: null });
    try {
      const data = await useGatewayStore.getState().rpc<{
          channelOrder?: string[];
          channels?: Record<string, unknown>;
          channelAccounts?: Record<string, Array<{
            accountId?: string;
            configured?: boolean;
            connected?: boolean;
            running?: boolean;
            lastError?: string;
            name?: string;
            linked?: boolean;
            lastConnectedAt?: number | null;
            lastInboundAt?: number | null;
            lastOutboundAt?: number | null;
          }>>;
          channelDefaultAccountId?: Record<string, string>;
      }>('channels.status', { probe: true });
      if (data) {
        const channels: Channel[] = [];

        // Parse the complex channels.status response into simple Channel objects
        const channelOrder = data.channelOrder || Object.keys(data.channels || {});
        for (const channelId of channelOrder) {
          const summary = (data.channels as Record<string, unknown> | undefined)?.[channelId] as Record<string, unknown> | undefined;
          const configured =
            typeof summary?.configured === 'boolean'
              ? summary.configured
              : typeof (summary as { running?: boolean })?.running === 'boolean'
                ? true
                : false;
          if (!configured) continue;

          const accounts = data.channelAccounts?.[channelId] || [];
          const summaryError =
            typeof (summary as { error?: string })?.error === 'string'
              ? (summary as { error?: string }).error
              : typeof (summary as { lastError?: string })?.lastError === 'string'
                ? (summary as { lastError?: string }).lastError
                : undefined;

          // Show each account as a separate card
          if (accounts.length > 0) {
            for (const account of accounts) {
              const now = Date.now();
              const RECENT_MS = 10 * 60 * 1000;
              const hasRecentActivity =
                (typeof account.lastInboundAt === 'number' && now - account.lastInboundAt < RECENT_MS) ||
                (typeof account.lastOutboundAt === 'number' && now - account.lastOutboundAt < RECENT_MS) ||
                (typeof account.lastConnectedAt === 'number' && now - account.lastConnectedAt < RECENT_MS);
              const isConnected = account.connected === true || account.linked === true || hasRecentActivity;
              const isRunning = account.running === true;
              const hasError = typeof account.lastError === 'string' && account.lastError;

              let status: Channel['status'] = 'disconnected';
              if (isConnected) {
                status = 'connected';
              } else if (isRunning && !hasError) {
                status = 'connected';
              } else if (hasError) {
                status = 'error';
              } else if (isRunning) {
                status = 'connecting';
              }

              const acctId = account.accountId || 'default';
              channels.push({
                id: `${channelId}-${acctId}`,
                type: channelId as ChannelType,
                name: account.name || (acctId === 'default' ? channelId : `${channelId} (${acctId})`),
                status,
                accountId: account.accountId,
                error:
                  (typeof account.lastError === 'string' ? account.lastError : undefined) ||
                  (typeof summaryError === 'string' ? summaryError : undefined),
              });
            }
          } else {
            // No per-account data, show a single card for the channel
            channels.push({
              id: `${channelId}-default`,
              type: channelId as ChannelType,
              name: channelId,
              status: summaryError ? 'error' : 'disconnected',
              error: typeof summaryError === 'string' ? summaryError : undefined,
            });
          }
        }

        set({ channels, loading: false });
      } else {
        // Gateway not available - try to show channels from local config
        set({ channels: [], loading: false });
      }
    } catch {
      // Gateway not connected, show empty
      set({ channels: [], loading: false });
    }
  },

  addChannel: async (params) => {
    try {
      const result = await useGatewayStore.getState().rpc<Channel>('channels.add', params);

      if (result) {
        set((state) => ({
          channels: [...state.channels, result],
        }));
        return result;
      } else {
        // If gateway is not available, create a local channel for now
        const newChannel: Channel = {
          id: `local-${Date.now()}`,
          type: params.type,
          name: params.name,
          status: 'disconnected',
        };
        set((state) => ({
          channels: [...state.channels, newChannel],
        }));
        return newChannel;
      }
    } catch {
      // Create local channel if gateway unavailable
      const newChannel: Channel = {
        id: `local-${Date.now()}`,
        type: params.type,
        name: params.name,
        status: 'disconnected',
      };
      set((state) => ({
        channels: [...state.channels, newChannel],
      }));
      return newChannel;
    }
  },

  deleteChannel: async (channelId) => {
    // Extract channel type and accountId from the channelId (format: "channelType-accountId")
    const dashIdx = channelId.indexOf('-');
    const channelType = dashIdx >= 0 ? channelId.slice(0, dashIdx) : channelId;
    const accountId = dashIdx >= 0 ? channelId.slice(dashIdx + 1) : undefined;

    try {
      // Delete the channel configuration from openclaw.json
      const deleteUrl = `/api/channels/config/${encodeURIComponent(channelType)}` +
        (accountId && accountId !== 'default' ? `?accountId=${encodeURIComponent(accountId)}` : '');
      await hostApiFetch(deleteUrl, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete channel config:', error);
    }

    try {
      await useGatewayStore.getState().rpc('channels.delete', { channelId: channelType });
    } catch (error) {
      // Continue with local deletion even if gateway fails
      console.error('Failed to delete channel from gateway:', error);
    }

    // Remove from local state
    set((state) => ({
      channels: state.channels.filter((c) => c.id !== channelId),
    }));
  },

  connectChannel: async (channelId) => {
    const { updateChannel } = get();
    updateChannel(channelId, { status: 'connecting', error: undefined });

    try {
      await useGatewayStore.getState().rpc('channels.connect', { channelId });
      updateChannel(channelId, { status: 'connected' });
    } catch (error) {
      updateChannel(channelId, { status: 'error', error: String(error) });
    }
  },

  disconnectChannel: async (channelId) => {
    const { updateChannel } = get();

    try {
      await useGatewayStore.getState().rpc('channels.disconnect', { channelId });
    } catch (error) {
      console.error('Failed to disconnect channel:', error);
    }

    updateChannel(channelId, { status: 'disconnected', error: undefined });
  },

  requestQrCode: async (channelType) => {
    return await useGatewayStore.getState().rpc<{ qrCode: string; sessionId: string }>(
      'channels.requestQr',
      { type: channelType },
    );
  },

  setChannels: (channels) => set({ channels }),

  updateChannel: (channelId, updates) => {
    set((state) => ({
      channels: state.channels.map((channel) =>
        channel.id === channelId ? { ...channel, ...updates } : channel
      ),
    }));
  },

  clearError: () => set({ error: null }),

  fetchBindings: async () => {
    try {
      const bindings = await invokeIpc('binding:list') as ChannelBinding[];
      set({ bindings: Array.isArray(bindings) ? bindings : [] });
    } catch {
      // ignore — bindings are optional
    }
  },

  setBinding: async (channelType: string, agentId: string | null, accountId?: string) => {
    await invokeIpc('binding:set', { channelType, agentId, accountId });
    // Update local state optimistically
    set((state) => {
      const filtered = state.bindings.filter((b) => {
        if (b.channelType !== channelType) return true;
        // Match by accountId when provided
        if (accountId) return b.accountId !== accountId;
        return b.accountId !== undefined;
      });
      if (agentId && agentId !== 'main') {
        filtered.push({ channelType, agentId, accountId });
      }
      return { bindings: filtered };
    });
  },

  getBindingAgent: (channelType: string, accountId?: string) => {
    const bindings = get().bindings;
    if (accountId) {
      // First try exact match with accountId
      const exact = bindings.find((b) => b.channelType === channelType && b.accountId === accountId);
      if (exact) return exact.agentId;
    }
    // Fallback to binding without accountId (default)
    return bindings.find((b) => b.channelType === channelType && !b.accountId)?.agentId;
  },
}));
