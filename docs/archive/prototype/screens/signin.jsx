/* global window, React */
// =========================================================================
// Sign-in / sign-up screen (Clerk-rendered placeholder, branded).
// =========================================================================
const { useState: useState_signin } = React;

function SignInScreen({ onSignIn }) {
  const { Button, Card, TextField, Eyebrow } = window.UI;
  const [email, setEmail] = useState_signin('mpatel@purdue.edu');
  const [pwd, setPwd] = useState_signin('•••••••••');

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-blue-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" aria-hidden="true">
          <svg width="100%" height="100%" viewBox="0 0 600 800">
            {Array.from({length: 24}).map((_, r) =>
              Array.from({length: 18}).map((__, c) => (
                <rect key={`${r}-${c}`} x={c*36} y={r*36} width={28} height={28} rx={2}
                      fill={(r*c) % 7 === 0 ? '#FDE725' : (r*c) % 5 === 0 ? '#1F9E89' : '#7AA5FF'}
                      opacity={((r+c) % 3 === 0) ? 0.5 : 0.18}/>
              ))
            )}
          </svg>
        </div>
        <div className="relative p-10">
          <div className="flex items-center gap-2.5">
            <window.Icons.Logo size={28}/>
            <span className="text-[18px] font-black tracking-tight">InsectID Checklist</span>
          </div>
        </div>
        <div className="relative p-10">
          <Eyebrow className="text-blue-300 mb-3">PURPOSE</Eyebrow>
          <h1 className="text-[40px] font-black leading-[1.05] text-white" style={{letterSpacing:'-0.012em'}}>
            From scattered occurrence records to a publication-ready checklist.
          </h1>
          <p className="text-[15px] text-blue-100 mt-5 max-w-md leading-relaxed">
            Pull GBIF and iNaturalist data for your taxon and region, verify every record,
            resolve taxonomic conflicts, and export manuscript-ready maps, tables, and a draft DOCX.
          </p>
          <div className="mt-8 flex items-center gap-4 text-[12px] text-blue-200">
            <span>Built for entomologists.</span>
            <span className="inline-block h-1 w-1 rounded-full bg-blue-400"/>
            <span>Built at the Insect Diversity & Diagnostics Lab · Purdue Entomology.</span>
          </div>
        </div>
        <div className="relative px-10 pb-10 text-[11.5px] text-blue-200 font-mono flex items-center gap-3">
          <span>v0.4.2 · prototype</span>
          <span className="text-blue-400">·</span>
          <span>GBIF backbone synced 2026-05-18</span>
        </div>
      </div>

      {/* Right sign-in panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-[420px] p-8" accent>
          <Eyebrow className="mb-2">SIGN IN VIA CLERK</Eyebrow>
          <h2 className="text-[24px] font-black text-blue-800 leading-tight">Welcome back</h2>
          <p className="text-[13.5px] text-text-500 mt-1.5">Sign in to continue to your projects.</p>

          <div className="flex flex-col gap-3 mt-6">
            <button className="h-10 px-3 border border-surface-3 rounded-md bg-white text-text-600 inline-flex items-center justify-center gap-2 text-[13.5px] font-semibold hover:bg-surface-1 whitespace-nowrap">
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-13l5.6-5.6A20 20 0 1 0 44 24a20 20 0 0 0-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 8 3l5.6-5.6A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.3A12 12 0 0 1 12.7 28.6l-6.6 5.1A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.2 5.3C42 35.1 44 30 44 24a20 20 0 0 0-.4-3.5z"/></svg>
              Continue with Google
            </button>
            <button className="h-10 px-3 border border-surface-3 rounded-md bg-white text-text-600 inline-flex items-center justify-center gap-2 text-[13.5px] font-semibold hover:bg-surface-1 whitespace-nowrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.9c.58.1.79-.25.79-.55v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.09 1.76 1.18 1.76 1.18 1.03 1.77 2.7 1.26 3.36.97.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.18-3.1-.12-.3-.51-1.48.11-3.08 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.78 0c2.21-1.5 3.18-1.18 3.18-1.18.62 1.6.23 2.78.11 3.08.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.05.78 2.12v3.15c0 .3.21.66.8.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"/></svg>
              Continue with GitHub
            </button>
            <button className="h-10 px-3 border border-surface-3 rounded-md bg-white text-text-600 inline-flex items-center justify-center gap-2 text-[13.5px] font-semibold hover:bg-surface-1 whitespace-nowrap">
              ORCID iD
            </button>
          </div>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-surface-3"/>
            <span className="text-[11px] text-text-400 uppercase tracking-[0.15em]">or</span>
            <div className="flex-1 h-px bg-surface-3"/>
          </div>

          <div className="space-y-3">
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@institution.edu" />
            <TextField label="Password" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" />
            <Button variant="primary" className="w-full h-10 justify-center" onClick={onSignIn}>Sign in</Button>
          </div>

          <div className="text-[12px] text-text-500 mt-5 text-center">
            New here? <button onClick={onSignIn} className="text-blue-600 font-semibold hover:underline">Request an account</button>
          </div>
          <div className="text-[11px] text-text-400 mt-5 text-center font-mono">
            Auth handled by Clerk · single-tenant per institution
          </div>
        </Card>
      </div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.SignInScreen = SignInScreen;
