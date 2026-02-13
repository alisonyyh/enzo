interface WelcomeScreenProps {
  onSignIn: () => void;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function WelcomeScreen({ onSignIn }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div className="w-[390px] h-screen bg-background flex flex-col items-center justify-center" style={{ paddingTop: '48px', paddingBottom: '34px' }}>
        {/* Centered content group */}
        <div className="flex flex-col items-center px-5 w-full">
          {/* Puppy Illustration */}
          <div className="text-[120px] leading-none mb-6">🐶</div>

          {/* App Name */}
          <h1 className="text-[32px] font-bold text-foreground mb-2">PupPlan</h1>

          {/* Tagline */}
          <p className="text-base text-muted-foreground text-center mb-8">
            A smarter routine for your new puppy
          </p>

          {/* Google Sign In Button */}
          <button
            onClick={onSignIn}
            className="w-full h-[50px] bg-white hover:bg-gray-50 text-[#3c4043] rounded-xl font-medium text-base transition-colors flex items-center justify-center gap-3 border border-[#dadce0]"
            style={{ fontFamily: 'SF Pro, -apple-system, system-ui, sans-serif' }}
          >
            <GoogleIcon className="size-[18px]" />
            Sign in with Google
          </button>

          {/* Terms and Privacy */}
          <div className="text-center mt-4 text-xs text-muted-foreground space-x-2">
            <a href="#" className="underline">
              Terms of Service
            </a>
            <span>•</span>
            <a href="#" className="underline">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
