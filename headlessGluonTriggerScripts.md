<!-- Supabase JS SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>
<script>
  const supabase = supabase.createClient(
    'https://plxdnhrdiqqaiyiljzfm.supabase.co',
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBseGRuaHJkaXFxYWl5aWxqemZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NDg2ODAsImV4cCI6MjA2OTUyNDY4MH0.3WzHgqG85ajp3Lx4UEoT5MnQlOno400GXohT6HSdhv0'
  )
</script>

<!-- Button click handler -->
<script type="module">
  const button = document.getElementById('get-compute-btn')

  button?.addEventListener('click', async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        alert('You must be logged in to start a session.')
        return
      }
      //!--final update point for completing the setup end-to-end--!//
        const response = await fetch('https://cw9ahgiyrl.execute-api.us-east-1.amazonaws.com/staging/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          instance_type: 't3.micro',
          ami_id: 'i-0e29df64808fe974e' 
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`Launch failed: ${err}`)
      }

      alert('Launching EC2 session...')
    } catch (err) {
      console.error(err)
      alert('Error starting session.')
    }
  })
</script>
