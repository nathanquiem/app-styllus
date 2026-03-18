const fs = require('fs');

function fixUpdatePassword(filePath) {
  let text = fs.readFileSync(filePath, 'utf-8');

  // Replace the simple useEffect with one that tracks onAuthStateChange
  const oldEffect = `  useEffect(() => {
    // Check if user is trying to update without auth session
    const checkHash = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      // If there's an error on hash resolution or auth, session could be null
      // The supabase client automatically parses the url fragments for the session
      if (!session) {
        // Just warning, user might still get session parsing on mount
      }
    }
    checkHash()
  }, [])`;

  const newEffect = `  useEffect(() => {
    // Capture the session from the URL hash right away
    const checkHash = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error("Session error:", error.message)
      }
    }
    checkHash()

    // Listen to changes (when Supabase parses the #access_token from the URL)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log("Password recovery session established");
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [supabase])`;

  // Fix line endings safely
  const normalizedText = text.replace(/\r\n/g, '\n');
  const normalizedOld = oldEffect.replace(/\r\n/g, '\n');

  if (normalizedText.includes(normalizedOld)) {
    text = normalizedText.replace(normalizedOld, newEffect);
    fs.writeFileSync(filePath, text, 'utf-8');
    console.log('Fixed auth session listener in', filePath);
  } else {
    console.log('Skipped (already fixed or not found) in', filePath);
  }
}

fixUpdatePassword('c:/Users/naelq/Documents/Projetos Antigravity/app-barbearia/src/app/update-password/page.tsx');
fixUpdatePassword('c:/Users/naelq/Documents/Projetos Antigravity/app-salao/src/app/update-password/page.tsx');
