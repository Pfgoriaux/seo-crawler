import { Page } from 'playwright';
import { NetworkData } from '../crawler/page-crawler';

export interface SecurityHeadersAnalysis {
  contentSecurityPolicy: CSPAnalysis;
  strictTransportSecurity: HSTSAnalysis;
  xFrameOptions: XFrameOptionsAnalysis;
  xContentTypeOptions: XContentTypeOptionsAnalysis;
  xXSSProtection: XXSSProtectionAnalysis;
  referrerPolicy: ReferrerPolicyAnalysis;
  permissionsPolicy: PermissionsPolicyAnalysis;
  crossOriginPolicies: CrossOriginPoliciesAnalysis;
  overallGrade: SecurityGrade;
  missingCriticalHeaders: string[];
  recommendations: string[];
  isHttps: boolean;
  score: number;
}

export interface CSPAnalysis {
  present: boolean;
  value?: string;
  hasUnsafeInline: boolean;
  hasUnsafeEval: boolean;
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  directives: string[];
  issues: string[];
}

export interface HSTSAnalysis {
  present: boolean;
  value?: string;
  maxAge?: number;
  includeSubDomains: boolean;
  preload: boolean;
  isValid: boolean;
  issues: string[];
}

export interface XFrameOptionsAnalysis {
  present: boolean;
  value?: string;
  isValid: boolean;
  protection: 'deny' | 'sameorigin' | 'allow-from' | 'invalid' | 'none';
  issues: string[];
}

export interface XContentTypeOptionsAnalysis {
  present: boolean;
  value?: string;
  isNosniff: boolean;
  issues: string[];
}

export interface XXSSProtectionAnalysis {
  present: boolean;
  value?: string;
  mode: 'disabled' | 'enabled' | 'block' | 'invalid' | 'none';
  issues: string[];
}

export interface ReferrerPolicyAnalysis {
  present: boolean;
  value?: string;
  privacyLevel: 'strong' | 'moderate' | 'weak' | 'none';
  policies: string[];
  issues: string[];
}

export interface PermissionsPolicyAnalysis {
  present: boolean;
  value?: string;
  restrictedFeatures: string[];
  issues: string[];
}

export interface CrossOriginPoliciesAnalysis {
  crossOriginOpenerPolicy: CrossOriginHeaderAnalysis;
  crossOriginEmbedderPolicy: CrossOriginHeaderAnalysis;
  crossOriginResourcePolicy: CrossOriginHeaderAnalysis;
}

export interface CrossOriginHeaderAnalysis {
  present: boolean;
  value?: string;
  isValid: boolean;
}

export type SecurityGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export async function analyzeSecurityHeaders(
  page: Page,
  networkData: NetworkData
): Promise<SecurityHeadersAnalysis> {
  const headers = normalizeHeaders(networkData.responseHeaders);
  const url = page.url();
  const isHttps = url.startsWith('https://');

  // Analyze individual headers
  const cspAnalysis = analyzeCSP(headers);
  const hstsAnalysis = analyzeHSTS(headers, isHttps);
  const xFrameOptionsAnalysis = analyzeXFrameOptions(headers);
  const xContentTypeOptionsAnalysis = analyzeXContentTypeOptions(headers);
  const xXSSProtectionAnalysis = analyzeXXSSProtection(headers);
  const referrerPolicyAnalysis = analyzeReferrerPolicy(headers);
  const permissionsPolicyAnalysis = analyzePermissionsPolicy(headers);
  const crossOriginPoliciesAnalysis = analyzeCrossOriginPolicies(headers);

  // Calculate score
  const score = calculateSecurityHeadersScore({
    contentSecurityPolicy: cspAnalysis,
    strictTransportSecurity: hstsAnalysis,
    xFrameOptions: xFrameOptionsAnalysis,
    xContentTypeOptions: xContentTypeOptionsAnalysis,
    xXSSProtection: xXSSProtectionAnalysis,
    referrerPolicy: referrerPolicyAnalysis,
    permissionsPolicy: permissionsPolicyAnalysis,
    crossOriginPolicies: crossOriginPoliciesAnalysis,
    isHttps,
    overallGrade: 'F', // Temporary, will be calculated
    missingCriticalHeaders: [],
    recommendations: [],
    score: 0,
  });

  // Determine missing critical headers
  const missingCriticalHeaders = getMissingCriticalHeaders({
    csp: cspAnalysis.present,
    hsts: hstsAnalysis.present,
    xFrameOptions: xFrameOptionsAnalysis.present,
    xContentTypeOptions: xContentTypeOptionsAnalysis.present,
    referrerPolicy: referrerPolicyAnalysis.present,
    isHttps,
  });

  // Generate recommendations
  const recommendations = generateRecommendations({
    isHttps,
    cspAnalysis,
    hstsAnalysis,
    xFrameOptionsAnalysis,
    xContentTypeOptionsAnalysis,
    xXSSProtectionAnalysis,
    referrerPolicyAnalysis,
    permissionsPolicyAnalysis,
    crossOriginPoliciesAnalysis,
  });

  // Calculate overall grade
  const overallGrade = calculateGrade(score);

  return {
    contentSecurityPolicy: cspAnalysis,
    strictTransportSecurity: hstsAnalysis,
    xFrameOptions: xFrameOptionsAnalysis,
    xContentTypeOptions: xContentTypeOptionsAnalysis,
    xXSSProtection: xXSSProtectionAnalysis,
    referrerPolicy: referrerPolicyAnalysis,
    permissionsPolicy: permissionsPolicyAnalysis,
    crossOriginPolicies: crossOriginPoliciesAnalysis,
    overallGrade,
    missingCriticalHeaders,
    recommendations,
    isHttps,
    score,
  };
}

function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

function analyzeCSP(headers: Record<string, string>): CSPAnalysis {
  const csp = headers['content-security-policy'];

  if (!csp) {
    return {
      present: false,
      hasUnsafeInline: false,
      hasUnsafeEval: false,
      strength: 'none',
      directives: [],
      issues: ['Content-Security-Policy header is not set'],
    };
  }

  const hasUnsafeInline = csp.includes("'unsafe-inline'");
  const hasUnsafeEval = csp.includes("'unsafe-eval'");
  const directives = csp.split(';').map(d => d.trim()).filter(d => d.length > 0);

  const issues: string[] = [];
  if (hasUnsafeInline) {
    issues.push("CSP contains 'unsafe-inline' which reduces XSS protection");
  }
  if (hasUnsafeEval) {
    issues.push("CSP contains 'unsafe-eval' which allows eval() and similar functions");
  }

  // Assess strength based on directives and unsafe keywords
  let strength: 'strong' | 'moderate' | 'weak' | 'none' = 'moderate';

  const hasDefaultSrc = directives.some(d => d.startsWith('default-src'));
  const hasScriptSrc = directives.some(d => d.startsWith('script-src'));
  const hasObjectSrc = directives.some(d => d.startsWith('object-src'));

  if (!hasDefaultSrc && !hasScriptSrc) {
    strength = 'weak';
    issues.push('CSP lacks default-src or script-src directive');
  } else if (hasUnsafeInline || hasUnsafeEval) {
    strength = 'weak';
  } else if (hasDefaultSrc && hasScriptSrc && hasObjectSrc) {
    strength = 'strong';
  }

  return {
    present: true,
    value: csp,
    hasUnsafeInline,
    hasUnsafeEval,
    strength,
    directives,
    issues,
  };
}

function analyzeHSTS(headers: Record<string, string>, isHttps: boolean): HSTSAnalysis {
  const hsts = headers['strict-transport-security'];

  if (!hsts) {
    const issues = isHttps
      ? ['Strict-Transport-Security header is not set on HTTPS site']
      : ['Site is not using HTTPS'];

    return {
      present: false,
      includeSubDomains: false,
      preload: false,
      isValid: false,
      issues,
    };
  }

  const maxAgeMatch = hsts.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : undefined;
  const includeSubDomains = hsts.includes('includeSubDomains');
  const preload = hsts.includes('preload');

  const issues: string[] = [];
  let isValid = true;

  if (!maxAge || maxAge < 1) {
    issues.push('HSTS max-age is missing or invalid');
    isValid = false;
  } else if (maxAge < 31536000) {
    issues.push('HSTS max-age is less than 1 year (recommended: 31536000 seconds)');
  }

  if (!includeSubDomains) {
    issues.push('HSTS does not include subdomains (includeSubDomains directive missing)');
  }

  if (!preload && maxAge && maxAge >= 31536000 && includeSubDomains) {
    issues.push('Consider adding preload directive for HSTS preload list inclusion');
  }

  return {
    present: true,
    value: hsts,
    maxAge,
    includeSubDomains,
    preload,
    isValid,
    issues,
  };
}

function analyzeXFrameOptions(headers: Record<string, string>): XFrameOptionsAnalysis {
  const xFrameOptions = headers['x-frame-options'];

  if (!xFrameOptions) {
    return {
      present: false,
      isValid: false,
      protection: 'none',
      issues: ['X-Frame-Options header is not set (clickjacking protection missing)'],
    };
  }

  const value = xFrameOptions.toUpperCase().trim();
  const issues: string[] = [];
  let protection: 'deny' | 'sameorigin' | 'allow-from' | 'invalid' | 'none';
  let isValid = true;

  if (value === 'DENY') {
    protection = 'deny';
  } else if (value === 'SAMEORIGIN') {
    protection = 'sameorigin';
  } else if (value.startsWith('ALLOW-FROM')) {
    protection = 'allow-from';
    issues.push('ALLOW-FROM is deprecated and not supported by modern browsers');
    isValid = false;
  } else {
    protection = 'invalid';
    issues.push(`Invalid X-Frame-Options value: ${xFrameOptions}`);
    isValid = false;
  }

  return {
    present: true,
    value: xFrameOptions,
    isValid,
    protection,
    issues,
  };
}

function analyzeXContentTypeOptions(headers: Record<string, string>): XContentTypeOptionsAnalysis {
  const xContentTypeOptions = headers['x-content-type-options'];

  if (!xContentTypeOptions) {
    return {
      present: false,
      isNosniff: false,
      issues: ['X-Content-Type-Options header is not set (MIME-sniffing protection missing)'],
    };
  }

  const isNosniff = xContentTypeOptions.toLowerCase().trim() === 'nosniff';
  const issues: string[] = [];

  if (!isNosniff) {
    issues.push(`Invalid X-Content-Type-Options value: ${xContentTypeOptions} (should be "nosniff")`);
  }

  return {
    present: true,
    value: xContentTypeOptions,
    isNosniff,
    issues,
  };
}

function analyzeXXSSProtection(headers: Record<string, string>): XXSSProtectionAnalysis {
  const xXSSProtection = headers['x-xss-protection'];

  if (!xXSSProtection) {
    return {
      present: false,
      mode: 'none',
      issues: ['X-XSS-Protection header is not set (legacy browsers may be vulnerable)'],
    };
  }

  const value = xXSSProtection.trim();
  const issues: string[] = [];
  let mode: 'disabled' | 'enabled' | 'block' | 'invalid' | 'none';

  if (value === '0') {
    mode = 'disabled';
    issues.push('X-XSS-Protection is disabled (0), which disables browser XSS filtering');
  } else if (value === '1') {
    mode = 'enabled';
    issues.push('X-XSS-Protection is enabled but should use "1; mode=block" for better protection');
  } else if (value.includes('1') && value.includes('mode=block')) {
    mode = 'block';
  } else {
    mode = 'invalid';
    issues.push(`Invalid X-XSS-Protection value: ${xXSSProtection}`);
  }

  // Note about modern CSP
  if (mode === 'block' || mode === 'enabled') {
    issues.push('Note: X-XSS-Protection is deprecated; use Content-Security-Policy instead');
  }

  return {
    present: true,
    value: xXSSProtection,
    mode,
    issues,
  };
}

function analyzeReferrerPolicy(headers: Record<string, string>): ReferrerPolicyAnalysis {
  const referrerPolicy = headers['referrer-policy'];

  if (!referrerPolicy) {
    return {
      present: false,
      privacyLevel: 'none',
      policies: [],
      issues: ['Referrer-Policy header is not set (referrer information may leak)'],
    };
  }

  const policies = referrerPolicy.split(',').map(p => p.trim()).filter(p => p.length > 0);
  const issues: string[] = [];
  let privacyLevel: 'strong' | 'moderate' | 'weak' | 'none' = 'moderate';

  // Evaluate privacy level based on policies
  const strongPolicies = ['no-referrer', 'same-origin'];
  const moderatePolicies = ['strict-origin', 'strict-origin-when-cross-origin', 'no-referrer-when-downgrade'];
  const weakPolicies = ['origin', 'origin-when-cross-origin', 'unsafe-url'];

  const hasStrongPolicy = policies.some(p => strongPolicies.includes(p));
  const hasWeakPolicy = policies.some(p => weakPolicies.includes(p));

  if (hasStrongPolicy) {
    privacyLevel = 'strong';
  } else if (hasWeakPolicy) {
    privacyLevel = 'weak';
    issues.push('Referrer-Policy uses weak privacy settings that may leak sensitive information');
  } else if (policies.some(p => moderatePolicies.includes(p))) {
    privacyLevel = 'moderate';
  } else {
    privacyLevel = 'weak';
    issues.push('Referrer-Policy contains unrecognized or weak values');
  }

  return {
    present: true,
    value: referrerPolicy,
    privacyLevel,
    policies,
    issues,
  };
}

function analyzePermissionsPolicy(headers: Record<string, string>): PermissionsPolicyAnalysis {
  const permissionsPolicy = headers['permissions-policy'] || headers['feature-policy'];

  if (!permissionsPolicy) {
    return {
      present: false,
      restrictedFeatures: [],
      issues: ['Permissions-Policy header is not set (browser features not restricted)'],
    };
  }

  // Parse the permissions policy to extract restricted features
  const restrictedFeatures: string[] = [];
  const issues: string[] = [];

  // Permissions-Policy uses a different format than Feature-Policy
  // Example: geolocation=(), microphone=()
  if (headers['permissions-policy']) {
    const features = permissionsPolicy.split(',').map(f => f.trim());
    for (const feature of features) {
      const featureName = feature.split('=')[0].trim();
      if (featureName) {
        restrictedFeatures.push(featureName);
      }
    }
  } else {
    // Feature-Policy format: geolocation 'none'; microphone 'none'
    const features = permissionsPolicy.split(';').map(f => f.trim());
    for (const feature of features) {
      const featureName = feature.split(' ')[0].trim();
      if (featureName) {
        restrictedFeatures.push(featureName);
      }
    }
    issues.push('Using deprecated Feature-Policy header; migrate to Permissions-Policy');
  }

  if (restrictedFeatures.length === 0) {
    issues.push('Permissions-Policy is set but no features are restricted');
  }

  return {
    present: true,
    value: permissionsPolicy,
    restrictedFeatures,
    issues,
  };
}

function analyzeCrossOriginPolicies(headers: Record<string, string>): CrossOriginPoliciesAnalysis {
  const coop = headers['cross-origin-opener-policy'];
  const coep = headers['cross-origin-embedder-policy'];
  const corp = headers['cross-origin-resource-policy'];

  const validCoopValues = ['unsafe-none', 'same-origin-allow-popups', 'same-origin'];
  const validCoepValues = ['unsafe-none', 'require-corp', 'credentialless'];
  const validCorpValues = ['same-site', 'same-origin', 'cross-origin'];

  return {
    crossOriginOpenerPolicy: {
      present: !!coop,
      value: coop,
      isValid: coop ? validCoopValues.includes(coop.trim()) : false,
    },
    crossOriginEmbedderPolicy: {
      present: !!coep,
      value: coep,
      isValid: coep ? validCoepValues.includes(coep.trim()) : false,
    },
    crossOriginResourcePolicy: {
      present: !!corp,
      value: corp,
      isValid: corp ? validCorpValues.includes(corp.trim()) : false,
    },
  };
}

function getMissingCriticalHeaders(params: {
  csp: boolean;
  hsts: boolean;
  xFrameOptions: boolean;
  xContentTypeOptions: boolean;
  referrerPolicy: boolean;
  isHttps: boolean;
}): string[] {
  const missing: string[] = [];

  if (!params.csp) {
    missing.push('Content-Security-Policy');
  }
  if (!params.hsts && params.isHttps) {
    missing.push('Strict-Transport-Security');
  }
  if (!params.xFrameOptions) {
    missing.push('X-Frame-Options');
  }
  if (!params.xContentTypeOptions) {
    missing.push('X-Content-Type-Options');
  }
  if (!params.referrerPolicy) {
    missing.push('Referrer-Policy');
  }

  return missing;
}

function generateRecommendations(params: {
  isHttps: boolean;
  cspAnalysis: CSPAnalysis;
  hstsAnalysis: HSTSAnalysis;
  xFrameOptionsAnalysis: XFrameOptionsAnalysis;
  xContentTypeOptionsAnalysis: XContentTypeOptionsAnalysis;
  xXSSProtectionAnalysis: XXSSProtectionAnalysis;
  referrerPolicyAnalysis: ReferrerPolicyAnalysis;
  permissionsPolicyAnalysis: PermissionsPolicyAnalysis;
  crossOriginPoliciesAnalysis: CrossOriginPoliciesAnalysis;
}): string[] {
  const recommendations: string[] = [];

  // HTTPS and HSTS
  if (!params.isHttps) {
    recommendations.push('Migrate to HTTPS to enable secure transport and HSTS protection');
  } else if (!params.hstsAnalysis.present) {
    recommendations.push('Add Strict-Transport-Security header: "max-age=31536000; includeSubDomains; preload"');
  } else if (params.hstsAnalysis.maxAge && params.hstsAnalysis.maxAge < 31536000) {
    recommendations.push('Increase HSTS max-age to at least 31536000 (1 year)');
  }

  // CSP
  if (!params.cspAnalysis.present) {
    recommendations.push('Implement Content-Security-Policy to protect against XSS and injection attacks');
  } else if (params.cspAnalysis.hasUnsafeInline) {
    recommendations.push("Remove 'unsafe-inline' from CSP and use nonces or hashes for inline scripts");
  } else if (params.cspAnalysis.hasUnsafeEval) {
    recommendations.push("Remove 'unsafe-eval' from CSP to prevent eval() usage");
  }

  // X-Frame-Options
  if (!params.xFrameOptionsAnalysis.present) {
    recommendations.push('Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking');
  } else if (params.xFrameOptionsAnalysis.protection === 'allow-from') {
    recommendations.push('Replace deprecated ALLOW-FROM with CSP frame-ancestors directive');
  }

  // X-Content-Type-Options
  if (!params.xContentTypeOptionsAnalysis.present) {
    recommendations.push('Add X-Content-Type-Options: nosniff to prevent MIME-sniffing');
  }

  // Referrer-Policy
  if (!params.referrerPolicyAnalysis.present) {
    recommendations.push('Add Referrer-Policy: strict-origin-when-cross-origin or no-referrer for privacy');
  } else if (params.referrerPolicyAnalysis.privacyLevel === 'weak') {
    recommendations.push('Use a stricter Referrer-Policy like "strict-origin-when-cross-origin" or "no-referrer"');
  }

  // Permissions-Policy
  if (!params.permissionsPolicyAnalysis.present) {
    recommendations.push('Add Permissions-Policy to restrict access to sensitive browser features');
  }

  // Cross-Origin Policies
  if (!params.crossOriginPoliciesAnalysis.crossOriginOpenerPolicy.present) {
    recommendations.push('Consider adding Cross-Origin-Opener-Policy: same-origin for enhanced isolation');
  }
  if (!params.crossOriginPoliciesAnalysis.crossOriginEmbedderPolicy.present) {
    recommendations.push('Consider adding Cross-Origin-Embedder-Policy: require-corp for cross-origin isolation');
  }
  if (!params.crossOriginPoliciesAnalysis.crossOriginResourcePolicy.present) {
    recommendations.push('Consider adding Cross-Origin-Resource-Policy: same-origin to control resource embedding');
  }

  return recommendations;
}

export function calculateSecurityHeadersScore(analysis: SecurityHeadersAnalysis): number {
  let score = 0;

  // HTTPS + HSTS: 25 points
  if (analysis.isHttps) {
    score += 10; // Base HTTPS
    if (analysis.strictTransportSecurity.present && analysis.strictTransportSecurity.isValid) {
      score += 10; // Valid HSTS
      if (analysis.strictTransportSecurity.maxAge && analysis.strictTransportSecurity.maxAge >= 31536000) {
        score += 3; // Good max-age
      }
      if (analysis.strictTransportSecurity.includeSubDomains) {
        score += 1; // includeSubDomains
      }
      if (analysis.strictTransportSecurity.preload) {
        score += 1; // preload
      }
    }
  }

  // CSP: 20 points
  if (analysis.contentSecurityPolicy.present) {
    if (analysis.contentSecurityPolicy.strength === 'strong') {
      score += 20;
    } else if (analysis.contentSecurityPolicy.strength === 'moderate') {
      score += 15;
    } else if (analysis.contentSecurityPolicy.strength === 'weak') {
      score += 8;
    }
  }

  // X-Frame-Options: 15 points
  if (analysis.xFrameOptions.present && analysis.xFrameOptions.isValid) {
    if (analysis.xFrameOptions.protection === 'deny') {
      score += 15;
    } else if (analysis.xFrameOptions.protection === 'sameorigin') {
      score += 13;
    }
  }

  // X-Content-Type-Options: 10 points
  if (analysis.xContentTypeOptions.present && analysis.xContentTypeOptions.isNosniff) {
    score += 10;
  }

  // Referrer-Policy: 10 points
  if (analysis.referrerPolicy.present) {
    if (analysis.referrerPolicy.privacyLevel === 'strong') {
      score += 10;
    } else if (analysis.referrerPolicy.privacyLevel === 'moderate') {
      score += 7;
    } else if (analysis.referrerPolicy.privacyLevel === 'weak') {
      score += 3;
    }
  }

  // Other headers: 20 points
  // X-XSS-Protection: 3 points (deprecated but still counts)
  if (analysis.xXSSProtection.present && analysis.xXSSProtection.mode === 'block') {
    score += 3;
  }

  // Permissions-Policy: 7 points
  if (analysis.permissionsPolicy.present && analysis.permissionsPolicy.restrictedFeatures.length > 0) {
    score += 7;
  }

  // Cross-Origin Policies: 10 points total (3 + 3 + 4)
  if (analysis.crossOriginPolicies.crossOriginOpenerPolicy.present &&
      analysis.crossOriginPolicies.crossOriginOpenerPolicy.isValid) {
    score += 3;
  }
  if (analysis.crossOriginPolicies.crossOriginEmbedderPolicy.present &&
      analysis.crossOriginPolicies.crossOriginEmbedderPolicy.isValid) {
    score += 3;
  }
  if (analysis.crossOriginPolicies.crossOriginResourcePolicy.present &&
      analysis.crossOriginPolicies.crossOriginResourcePolicy.isValid) {
    score += 4;
  }

  return Math.min(100, Math.max(0, score));
}

function calculateGrade(score: number): SecurityGrade {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}
