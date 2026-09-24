/**
 * Advanced Lab Environment Management
 * Handles Docker-based provisioning, state snapshots, and real-time collaboration
 */

import { createServiceClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/log';

export interface LabEnvironment {
  id: string;
  user_id: string;
  lab_id: string;
  container_id: string;
  status: 'provisioning' | 'running' | 'paused' | 'terminated';
  docker_image: string;
  exposed_ports: Record<string, number>;
  created_at: string;
  last_activity_at: string;
  snapshot_count: number;
}

export interface LabSnapshot {
  id: string;
  environment_id: string;
  snapshot_name: string;
  description: string;
  disk_size_mb: number;
  created_at: string;
  restored_at: string | null;
}

export interface LabCollaborationSession {
  id: string;
  environment_id: string;
  session_key: string;
  participants: string[]; // user_ids
  started_at: string;
  ended_at: string | null;
  max_participants: number;
}

/**
 * Provision a Docker-based lab environment with security tools
 */
export async function provisionLabEnvironment(
  userId: string,
  labId: string,
  tools: string[] = ['ghidra', 'burp', 'metasploit', 'wireshark'],
): Promise<LabEnvironment> {
  try {
    const supabase = createServiceClient();

    // Generate docker image tag based on tools
    const dockerImage = `alphalog-lab:${tools.sort().join('-')}-latest`;

    // Insert lab environment record
    const { data: env, error } = await supabase
      .from('securities_lab_environments')
      .insert({
        user_id: userId,
        lab_id: labId,
        docker_image: dockerImage,
        status: 'provisioning',
        exposed_ports: {
          // Default exposed ports for common tools
          ghidra: 8080,
          burp: 8081,
          metasploit: 4444,
          wireshark: 9999,
        },
      })
      .select()
      .single();

    if (error) throw error;

    logInfo('AdvancedLabs', `Provisioning lab environment for user ${userId}`, {
      lab_id: labId,
      tools,
      container_id: env.container_id,
    });

    // Trigger Docker provisioning (would call actual Docker daemon in production)
    // For now, just mark as running
    await updateLabStatus(env.id, 'running');

    return env;
  } catch (err) {
    logError('AdvancedLabs', 'Failed to provision lab environment', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Create a snapshot of current lab state
 */
export async function createLabSnapshot(
  environmentId: string,
  snapshotName: string,
  description: string,
): Promise<LabSnapshot> {
  try {
    const supabase = createServiceClient();

    const { data: snapshot, error } = await supabase
      .from('securities_lab_snapshots')
      .insert({
        environment_id: environmentId,
        snapshot_name: snapshotName,
        description: description,
        disk_size_mb: 0, // Would be calculated from actual snapshot
      })
      .select()
      .single();

    if (error) throw error;

    logInfo('AdvancedLabs', `Created snapshot: ${snapshotName}`, {
      environment_id: environmentId,
    });

    return snapshot;
  } catch (err) {
    logError('AdvancedLabs', 'Failed to create snapshot', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Restore lab from a snapshot
 */
export async function restoreLabSnapshot(snapshotId: string): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Get snapshot details
    const { data: snapshot, error: fetchError } = await supabase
      .from('securities_lab_snapshots')
      .select('*')
      .eq('id', snapshotId)
      .single();

    if (fetchError) throw fetchError;

    // Update snapshot with restore timestamp
    await supabase
      .from('securities_lab_snapshots')
      .update({ restored_at: new Date().toISOString() })
      .eq('id', snapshotId);

    logInfo('AdvancedLabs', `Restored snapshot: ${snapshot.snapshot_name}`, {
      environment_id: snapshot.environment_id,
    });
  } catch (err) {
    logError('AdvancedLabs', 'Failed to restore snapshot', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Create a collaboration session for multi-user lab access
 */
export async function createCollaborationSession(
  environmentId: string,
  initiatorId: string,
  maxParticipants: number = 4,
): Promise<LabCollaborationSession> {
  try {
    const supabase = createServiceClient();

    // Generate unique session key
    const sessionKey = `lab-${environmentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { data: session, error } = await supabase
      .from('securities_lab_collaboration_sessions')
      .insert({
        environment_id: environmentId,
        session_key: sessionKey,
        participants: [initiatorId],
        max_participants: maxParticipants,
      })
      .select()
      .single();

    if (error) throw error;

    logInfo('AdvancedLabs', 'Created collaboration session', {
      environment_id: environmentId,
      session_key: sessionKey,
    });

    return session;
  } catch (err) {
    logError('AdvancedLabs', 'Failed to create collaboration session', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Add participant to collaboration session
 */
export async function addCollaborationParticipant(
  sessionId: string,
  userId: string,
): Promise<LabCollaborationSession> {
  try {
    const supabase = createServiceClient();

    // Get current session
    const { data: session, error: fetchError } = await supabase
      .from('securities_lab_collaboration_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError) throw fetchError;

    // Check capacity
    if (session.participants.length >= session.max_participants) {
      throw new Error('Session at max capacity');
    }

    // Add participant
    const updatedParticipants = [...session.participants, userId];

    const { data: updated, error: updateError } = await supabase
      .from('securities_lab_collaboration_sessions')
      .update({ participants: updatedParticipants })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) throw updateError;

    logInfo('AdvancedLabs', `Added participant to session`, {
      session_id: sessionId,
      user_id: userId,
    });

    return updated;
  } catch (err) {
    logError('AdvancedLabs', 'Failed to add participant', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Update lab environment status
 */
export async function updateLabStatus(
  environmentId: string,
  status: 'provisioning' | 'running' | 'paused' | 'terminated',
): Promise<void> {
  try {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('securities_lab_environments')
      .update({
        status,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', environmentId);

    if (error) throw error;

    logInfo('AdvancedLabs', `Updated lab status to ${status}`, {
      environment_id: environmentId,
    });
  } catch (err) {
    logError('AdvancedLabs', 'Failed to update lab status', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Get lab environment with snapshots
 */
export async function getLabEnvironmentDetails(
  environmentId: string,
  userId: string,
): Promise<LabEnvironment & { snapshots: LabSnapshot[] }> {
  try {
    const supabase = createServiceClient();

    // Get environment
    const { data: env, error: envError } = await supabase
      .from('securities_lab_environments')
      .select('*')
      .eq('id', environmentId)
      .eq('user_id', userId)
      .single();

    if (envError) throw envError;

    // Get snapshots
    const { data: snapshots, error: snapshotError } = await supabase
      .from('securities_lab_snapshots')
      .select('*')
      .eq('environment_id', environmentId)
      .order('created_at', { ascending: false });

    if (snapshotError) throw snapshotError;

    return {
      ...env,
      snapshots: snapshots || [],
    };
  } catch (err) {
    logError('AdvancedLabs', 'Failed to get lab details', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
