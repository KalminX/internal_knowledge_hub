import { OrgRole, DocumentAccessScope, DocumentAccessRule, DocumentRecord } from '../types';

export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 40,
  admin: 30,
  editor: 20,
  member: 10,
};

export function hasMinimumRole(userRole: OrgRole, requiredRole: OrgRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canManageOrganization(userRole: OrgRole): boolean {
  return userRole === 'owner';
}

export function canManageMembers(userRole: OrgRole): boolean {
  return hasMinimumRole(userRole, 'admin');
}

export function canUploadDocuments(userRole: OrgRole): boolean {
  return hasMinimumRole(userRole, 'editor');
}

export function canEditDocument(userRole: OrgRole, document: DocumentRecord, userId: string): boolean {
  if (hasMinimumRole(userRole, 'admin')) return true;
  if (userRole === 'editor') {
    // Editors can edit if created by them or if granted by access rule
    if (document.createdBy === userId) return true;
    const rules = document.accessRules || [];
    return rules.some(r => r.canEdit && ((r.targetType === 'user' && r.targetValue === userId) || (r.targetType === 'role' && r.targetValue === 'editor')));
  }
  return false;
}

export function canRetireDocument(userRole: OrgRole): boolean {
  return hasMinimumRole(userRole, 'admin');
}

export function canViewAnalytics(userRole: OrgRole): boolean {
  return hasMinimumRole(userRole, 'admin');
}

export function canViewAuditLogs(userRole: OrgRole): boolean {
  return hasMinimumRole(userRole, 'admin');
}

export function canAccessDocument(
  userRole: OrgRole,
  userId: string,
  userDepartment: string | undefined,
  document: {
    status: string;
    accessScope: DocumentAccessScope;
    createdBy?: string;
    accessRules?: DocumentAccessRule[];
  }
): boolean {
  // Check document status: non-ready documents are only visible to editors/admins/owners
  if (document.status !== 'ready') {
    return hasMinimumRole(userRole, 'editor');
  }

  // Owners and admins have full access across the organization
  if (hasMinimumRole(userRole, 'admin')) {
    return true;
  }

  // Organization-wide scope: any active member can view
  if (document.accessScope === 'organization') {
    return true;
  }

  // Restricted or Confidential scope: check explicit rules
  const rules = document.accessRules || [];
  const matchesUser = rules.some(
    (rule) => rule.canView && rule.targetType === 'user' && rule.targetValue === userId
  );
  if (matchesUser) return true;

  const matchesRole = rules.some(
    (rule) => rule.canView && rule.targetType === 'role' && rule.targetValue === userRole
  );
  if (matchesRole) return true;

  if (userDepartment) {
    const matchesDept = rules.some(
      (rule) => rule.canView && rule.targetType === 'department' && rule.targetValue.toLowerCase() === userDepartment.toLowerCase()
    );
    if (matchesDept) return true;
  }

  return false;
}
