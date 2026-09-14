import Link from "next/link";
import { getWorkspaceStore } from "@/lib/db";import { getUser } from "@/lib/auth";
import { IncidentCard, EmptyState } from "@/app/ui";
import { IntegrationLogo } from "@/app/integrations";
export const dynamic="force-dynamic";
export default async function Home(){const user=await getUser();if(!user)return <Landing/>;const store=await getWorkspaceStore();const workflows=await store.workflows.list();const incidents=await store.incidents.list();const connections=await store.connections.list();const open=incidents.filter(i=>i.status==="open");const attention=new Set(open.map(i=>i.workflowId));const healthy=Math.max(workflows.length-attention.size,0);const protectedCount=workflows.length;return <div className="command-center">
<section className="command-hero"><div><span className="section-kicker"><i/> OUTCOM COMMAND CENTER</span><h1>Know when automation<br/><em>looks successful but isn't.</em></h1><p>Outcom sits outside your automation stack and verifies the business state that actually matters. Built for agencies running critical workflows across clients.</p><div className="hero-cta-row"><Link className="primary-cta" href="/connect">Connect your stack <span>↗</span></Link><Link className="secondary-cta" href="/workflows">View protected workflows</Link></div></div><div className="hero-proof-card"><div className="proof-card-top"><span>OUTCOME ASSURANCE</span><b><i/> READ-ONLY</b></div><div className="proof-line"><div><IntegrationLogo name="n8n" size={21}/><strong>Automation execution</strong></div><span className="pass">SUCCESS ✓</span></div><div className="proof-gap">but the business state says…</div><div className="proof-line light"><div><IntegrationLogo name="ghl" size={21}/><strong>Customer record</strong></div><span className="fail">MISMATCH ✕</span></div><div className="proof-result"><span>OUTCOM</span><strong>Execution is not proof.</strong><small>execution → entity → downstream state → evidence</small></div></div></section>
<section className="executive-metrics"><div className="metric-card featured"><span>PROTECTED WORKFLOWS</span><strong>{protectedCount}</strong><small>across your workspace</small></div><div className="metric-card"><span>HEALTHY</span><strong className="metric-green">{healthy}</strong><small>business outcomes verified</small></div><div className="metric-card"><span>OPEN FINDINGS</span><strong className={open.length?"metric-red":"metric-green"}>{open.length}</strong><small>{open.length?"requiring investigation":"nothing needs attention"}</small></div><div className="metric-card"><span>STACK COVERAGE</span><strong>{connections.length}/4</strong><small>observer-ready providers</small></div></section>
<section className="dashboard-section"><div className="section-heading-row"><div><span className="section-kicker">01 / EXECUTIVE VIEW</span><h2>What deserves attention</h2></div><Link href="/incidents">View findings →</Link></div>{open.length?<div className="finding-grid"><IncidentCard incident={open[0]} workflow={workflows.find(w=>w.id===open[0].workflowId)?.name}/><div className="finding-side-stack">{open.slice(1,3).map(i=><IncidentCard key={i.id} incident={i} workflow={workflows.find(w=>w.id===i.workflowId)?.name}/>)}</div></div>:<EmptyState title="Your protected outcomes are clean.">No business-state mismatch has been detected.</EmptyState>}</section>
<section className="dashboard-section"><div className="section-heading-row"><div><span className="section-kicker">02 / FLEET</span><h2>Protected workflows</h2></div><Link href="/workflows">Open fleet →</Link></div>{workflows.length?<div className="workflow-table"><div className="workflow-table-head"><span>WORKFLOW</span><span>PLATFORM</span><span>LAST VERIFIED</span><span>STATUS</span></div>{await Promise.all(workflows.slice(0,8).map(async w=>{const events=await store.events.list(w.id);const cs=await store.contracts.list(w.id);const issue=open.some(i=>i.workflowId===w.id);return <Link className="workflow-table-row" href={`/workflows/${w.id}`} key={w.id}><div className="workflow-primary"><span className="workflow-platform-dot"><IntegrationLogo name={w.platform as any} size={18}/></span><div><strong>{w.name}</strong><small>{cs.length} outcome check{cs.length===1?"":"s"}</small></div></div><span>{w.platform}</span><span>{events[0]?new Date(events[0].timestamp).toLocaleString():"Awaiting first observation"}</span><span className={`status-badge ${issue?"bad":"good"}`}>{issue?"Needs attention":"Healthy"}</span></Link>}))}</div>:<EmptyState title="No workflows are protected yet.">Connect an automation platform and put one real workflow under outcome assurance.</EmptyState>}</section>
<section className="assurance-section"><div><span className="section-kicker">03 / WHY AGENCIES PAY FOR THIS</span><h2>Reliability is not an execution log.</h2><p>Outcom is designed around the gap between technical success and business correctness. It does not ask an agency to add another monitoring node or manually write assertions for every client workflow.</p></div><div className="assurance-grid"><div><b>01</b><strong>External observer</strong><small>Native APIs. No instrumentation.</small></div><div><b>02</b><strong>Outcome inference</strong><small>Read topology and identify meaningful writes.</small></div><div><b>03</b><strong>State memory</strong><small>Detect regressions after a successful run.</small></div><div><b>04</b><strong>Evidence graph</strong><small>Execution → entity → state → impact.</small></div></div></section>
</div>}

function Landing(){return <div className="landing-page">
  <nav className="landing-nav">
    <a href="#top" className="landing-brand"><img src="/outcom-logo.png" alt="Outcom" className="landing-logo"/></a>
    <div className="landing-nav-center">
      <a href="#why">Why Outcom</a><a href="#how">How it works</a><a href="#stack">Stack</a><a href="#proof">Proof</a>
    </div>
    <div className="landing-nav-actions"><Link className="landing-nav-link" href="/auth/login">Sign in</Link><Link className="landing-nav-cta" href="/auth/signup">Request access <span>↗</span></Link></div>
  </nav>

  <main id="top">
    <section className="landing-hero-v2">
      <div className="landing-hero-copy">
        <div className="landing-kicker"><i/> BUSINESS OUTCOME ASSURANCE FOR AUTOMATION AGENCIES</div>
        <h1><span className="hero-word hero-green">Green</span> execution.<br/><span className="hero-word hero-wrong">Wrong</span> <span className="hero-word hero-outcome">outcome.</span></h1>
        <p className="landing-lede">Your automation can finish successfully while the customer record, CRM state, or downstream business result is wrong. Outcom sits outside the workflow and proves what actually happened.</p>
        <div className="landing-actions"><Link className="primary-cta" href="/auth/signup">Build a protected workspace <span>↗</span></Link><a className="secondary-cta" href="#proof">See the proof chain ↓</a></div>
        <div className="landing-trustline"><span>READ-ONLY BY DESIGN</span><i/> <span>NO WORKFLOW INSTRUMENTATION</span><i/> <span>BUILT FOR CLIENT FLEETS</span></div>
      </div>
      <div className="landing-hero-visual" aria-label="Outcom outcome assurance example">
        <div className="mascot-orb mascot-hero" aria-hidden="true"><img src="/outcom-mascot.png" alt=""/></div>
        <div className="visual-window-bar"><span><i/><i/><i/></span><b>OUTCOM / LIVE ASSURANCE</b><small>READ-ONLY</small></div>
        <div className="visual-window-body">
          <div className="visual-summary"><div><span>WORKFLOW</span><strong>Lead → CRM</strong></div><div><span>VERDICT</span><strong className="green-text">MISMATCH</strong></div><div><span>LATENCY</span><strong>42 sec</strong></div></div>
          <div className="visual-chain">
            <div className="chain-node"><small>01 · EXECUTION</small><div><IntegrationLogo name="n8n" size={22}/><strong>Successful run</strong></div><em className="ok-pill">SUCCESS ✓</em></div>
            <div className="chain-arrow">→</div>
            <div className="chain-node"><small>02 · ENTITY</small><div><IntegrationLogo name="ghl" size={22}/><strong>Contact&nbsp;#4821</strong></div><em>IDENTIFIED</em></div>
            <div className="chain-arrow">→</div>
            <div className="chain-node alert"><small>03 · BUSINESS STATE</small><div><span className="state-dot"/><strong>Expected tag missing</strong></div><em className="bad-pill">MISMATCH ✕</em></div>
          </div>
          <div className="visual-proof"><div><span>OUTCOM VERDICT</span><strong>Technical success ≠ business success</strong></div><div className="proof-mini"><span>Evidence</span><b>3 linked signals</b></div></div>
        </div>
      </div>
    </section>

    <section className="landing-marquee" id="stack" aria-label="Outcom platform coverage">
      <div className="marquee-swipe-hint" aria-hidden="true">SWIPE TO EXPLORE <span>→</span></div>
      <div className="marquee-track">
        {[0,1].map(copy => <div className="marquee-set" key={copy} aria-hidden={copy === 1}>
          <span className="marquee-label">OBSERVE</span>
          {(["n8n","make","zapier","ghl"] as const).map(name => <div className="marquee-platform" key={name}><IntegrationLogo name={name} size={25}/><b>{name === "ghl" ? "HighLevel" : name === "n8n" ? "n8n" : name[0].toUpperCase()+name.slice(1)}</b></div>)}
          <span className="marquee-label">VERIFY</span>
          {(["Execution","Entity","State","Evidence"] as const).map(item => <div className="marquee-tab" key={item}>{item}</div>)}
          <span className="marquee-label">PROVE</span>
        </div>)}
      </div>
    </section>

    <section className="landing-section landing-section-why" id="why">
      <div className="mascot-orb mascot-why" aria-hidden="true"><img src="/outcom-mascot.png" alt=""/></div>
      <div className="landing-section-intro"><div><span className="section-number">01</span><span className="section-kicker">THE GAP</span></div><h2>Execution logs answer<br/><em>the wrong question.</em></h2><p>Automation platforms tell you whether a workflow ran. Agencies need to know whether the client got the result they were promised.</p></div>
      <div className="landing-feature-grid">
        <article className="landing-feature dark"><span>01 / OBSERVE FROM OUTSIDE</span><h3>No HTTP node.<br/>No instrumentation.</h3><p>Outcom reads native workflow definitions and execution history instead of asking builders to modify every client automation.</p><div className="feature-tag">READ-ONLY OBSERVER</div></article>
        <article className="landing-feature"><span>02 / VERIFY THE RESULT</span><h3>Business state,<br/>not just uptime.</h3><p>Correlate a successful execution to the affected entity, then inspect the downstream state that actually matters.</p><div className="feature-visual"><span>Execution</span><i>→</i><span>Entity</span><i>→</i><span>State</span></div></article>
        <article className="landing-feature"><span>03 / REMEMBER REGRESSIONS</span><h3>Catch the failure<br/>that comes later.</h3><p>Historical state snapshots make it possible to detect a field or tag that was correct yesterday and silently disappeared today.</p><div className="regression-line"><b>Yesterday</b><i/><b>Today</b><strong>STATE CHANGED</strong></div></article>
        <article className="landing-feature wide"><div><span>04 / EVIDENCE FOR THE CLIENT</span><h3>Don't send another screenshot of a green check.</h3><p>Give your team a causal proof chain: execution → node → entity → downstream state → impact. The difference between “it ran” and “it worked.”</p></div><div className="evidence-stack"><div><small>EXECUTION</small><b>run_84921</b><span>SUCCESS</span></div><div><small>ENTITY</small><b>contact_4821</b><span>FOUND</span></div><div className="evidence-alert"><small>OUTCOME</small><b>tag: paid-customer</b><span>MISSING</span></div></div></article>
      </div>
    </section>

    <section className="landing-section process-section" id="how">
      <div className="mascot-orb mascot-process" aria-hidden="true"><img src="/outcom-mascot.png" alt=""/></div>
      <div className="landing-section-intro compact"><div><span className="section-number">02</span><span className="section-kicker">HOW IT WORKS</span></div><h2>From workflow to<br/><em>proof in three moves.</em></h2></div>
      <div className="process-grid"><article><b>01</b><span>CONNECT</span><h3>Connect the stack you already run.</h3><p>Bring in n8n, Make, Zapier and HighLevel. Keep the automation itself untouched.</p></article><article><b>02</b><span>INFER & VERIFY</span><h3>Outcom reconstructs the outcome.</h3><p>We read topology, observe runs, correlate entities and inspect downstream business state.</p></article><article><b>03</b><span>PROVE & REMEMBER</span><h3>Turn silent failure into evidence.</h3><p>Get a verdict, causal evidence and historical context your agency can act on and explain.</p></article></div>
    </section>

    <section className="landing-proof-v2" id="proof">
      <div className="mascot-orb mascot-proof" aria-hidden="true"><img src="/outcom-mascot.png" alt=""/></div>
      <div className="proof-v2-copy"><span className="section-kicker">03 / THE OUTCOM STANDARD</span><h2>When green isn't<br/><em>good enough.</em></h2><p>A successful API response is not proof that a lead was routed, a tag survived, or a customer reached the right state.</p><Link className="primary-cta" href="/auth/signup">Protect your first workflow ↗</Link></div>
      <div className="proof-v2-card"><div className="proof-v2-head"><span>OUTCOME ASSURANCE</span><b><i/> LIVE OBSERVER</b></div><div className="proof-v2-row"><span>Automation</span><strong>n8n · Lead qualification</strong><em className="ok-pill">SUCCESS</em></div><div className="proof-v2-row"><span>Entity</span><strong>HighLevel · Contact&nbsp;#4821</strong><em>FOUND</em></div><div className="proof-v2-row critical"><span>Business state</span><strong>Expected tag: <b>paid-customer</b></strong><em className="bad-pill">MISSING</em></div><div className="proof-v2-verdict"><span>VERDICT</span><strong>Workflow succeeded.<br/>Outcome did not.</strong><small>3 signals · 1 mismatch · 42 sec detection</small></div></div>
    </section>

    <section className="landing-section stack-section">
      <div className="mascot-orb mascot-stack" aria-hidden="true"><img src="/outcom-mascot.png" alt=""/></div>
      <div className="landing-section-intro compact"><div><span className="section-number">04</span><span className="section-kicker">BUILT AROUND YOUR STACK</span></div><h2>One assurance layer.<br/><em>Your existing tools.</em></h2></div>
      <div className="stack-carousel"><div className="stack-carousel-track">
        {(["n8n","make","zapier","ghl","n8n","make","zapier","ghl"] as const).map((name, i) => <div className="stack-card glass-card" key={`${name}-${i}`}><div className="stack-card-logo"><IntegrationLogo name={name} size={42}/></div><strong>{name === "ghl" ? "HighLevel" : name === "n8n" ? "n8n" : name[0].toUpperCase()+name.slice(1)}</strong><span>{name === "ghl" ? "Downstream business state" : name === "n8n" ? "Native workflow observation" : name === "make" ? "Scenario fleet coverage" : "Zap discovery & assurance"}</span></div>)}
      </div></div>
    </section>

    <section className="landing-final">
      <div className="mascot-orb mascot-final" aria-hidden="true"><img src="/outcom-mascot.png" alt=""/></div><div><span className="section-kicker">FOR AGENCIES THAT OWN THE OUTCOME</span><h2>Stop proving that<br/><em>the workflow ran.</em></h2><p>Start proving that the client got what they expected.</p></div><Link className="final-cta" href="/auth/signup">Build Outcom <span>↗</span></Link></section>
  </main>
  <footer className="landing-footer"><div><img src="/outcom-logo.png" alt="Outcom"/><p>Business outcome assurance for automation agencies.</p><a className="footer-email" href="mailto:outcom.devv@gmail.com">outcom.devv@gmail.com</a></div><div><span>PRODUCT</span><a href="#why">Why Outcom</a><a href="#how">How it works</a><a href="#stack">Stack</a></div><div><span>ACCESS</span><Link href="/auth/login">Sign in</Link><Link href="/auth/signup">Request access</Link></div><small>© 2026 Outcom. Built for agencies that own the outcome.</small></footer>
</div>}
