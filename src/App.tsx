import './styles.css'
import { useAutonomousStatus } from './hooks/useAutonomousStatus'
import { AppShell } from './components/layout/AppShell'
import { Header } from './components/layout/Header'
import { AccountSummary } from './components/dashboard/AccountSummary'
import { HeroAgentStatus } from './components/dashboard/HeroAgentStatus'
import { OpenCfdPositions } from './components/dashboard/OpenCfdPositions'
import { OpportunityWatchlist } from './components/dashboard/OpportunityWatchlist'
import { CFDExpertPanel } from './components/dashboard/CFDExpertPanel'
import { RealtimeReadiness } from './components/dashboard/RealtimeReadiness'
import { VTMarketsReadiness } from './components/dashboard/VTMarketsReadiness'
import { ActivityFeed } from './components/dashboard/ActivityFeed'
import { PerformanceIntelligence } from './components/dashboard/PerformanceIntelligence'
import { TradingCalendar } from './components/dashboard/TradingCalendar'
import { MicroProfitPanel } from './components/dashboard/MicroProfitPanel'
import { TraderDecisionEngine } from './components/dashboard/TraderDecisionEngine'
import { AgentEffectivenessMonitor } from './components/dashboard/AgentEffectivenessMonitor'
import { CFDTraderSkillPanel } from './components/dashboard/CFDTraderSkillPanel'
import { DefensiveDiagnosticMode } from './components/dashboard/DefensiveDiagnosticMode'
import { LossAttributionPanel } from './components/dashboard/LossAttributionPanel'
import { LossPatternFirewallPanel } from './components/dashboard/LossPatternFirewallPanel'
import { AgentLearningPanel } from './components/dashboard/AgentLearningPanel'
import { MarketNewsIntelligence } from './components/dashboard/MarketNewsIntelligence'
import { CFDResearchLearningPanel } from './components/dashboard/CFDResearchLearningPanel'
import { ProfessionalTradingLibraryPanel } from './components/dashboard/ProfessionalTradingLibraryPanel'
import { LearningCampaignMonitor } from './components/dashboard/LearningCampaignMonitor'
import { ProfessionalSystemAudit } from './components/dashboard/ProfessionalSystemAudit'

export default function App() {
  const { status, error, lastRefresh, refresh } = useAutonomousStatus()

  if (!status) {
    return (
      <AppShell>
        <Header />
        <section className="panel">
          <h2>Cargando Global Broker AI v2...</h2>
          <p className="muted">Primera pantalla rapida; los feeds vivos entran en background.</p>
          {error ? <p className="warning">{error}</p> : null}
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Header />
      <AccountSummary account={status.account} />
      <HeroAgentStatus status={status} />
      <div className="refresh-line">
        UI refresh: {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : 'pendiente'} - Server: {new Date(status.serverTime).toLocaleTimeString()}
      </div>

      <OpenCfdPositions maxPositions={status.limits?.maxTotalOpenPositions ?? 10} onClosed={refresh} positions={status.openPositions} />
      <AgentEffectivenessMonitor effectiveness={status.agentEffectiveness} firewall={status.lossPatternFirewall} learningCampaign={status.learningCampaign} />
      <MicroProfitPanel microProfit={status.microProfit} />
      <TraderDecisionEngine decision={status.traderDecision} />
      <OpportunityWatchlist opportunities={status.opportunities} blocked={status.blockedOpportunities} />
      <ActivityFeed items={status.activityFeed} />

      <CFDTraderSkillPanel skill={status.cfdTraderSkill} />
      <CFDExpertPanel evaluation={status.cfdExpert.lastEvaluation} />
      <RealtimeReadiness feeds={status.feeds} />
      <VTMarketsReadiness vt={status.vtMarkets} />

      <ProfessionalSystemAudit audit={status.professionalAudit} watchdog={status.noPositionWatchdog} />
      <DefensiveDiagnosticMode diagnostic={status.defensiveDiagnostic} />
      <AgentLearningPanel learning={status.adaptiveLearning} />
      <MarketNewsIntelligence news={status.marketNews} />
      <ProfessionalTradingLibraryPanel library={status.professionalTradingLibrarySkill} />
      <CFDResearchLearningPanel learning={status.cfdResearchLearning} />
      <LearningCampaignMonitor campaign={status.learningCampaign} />
      <LossPatternFirewallPanel firewall={status.lossPatternFirewall} />
      <LossAttributionPanel attribution={status.lossAttribution} leverage={status.leverageDamage} target={status.targetFeasibility} />
      <PerformanceIntelligence performance={status.performance} />
      <TradingCalendar />
    </AppShell>
  )
}
