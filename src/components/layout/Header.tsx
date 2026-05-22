import { Badge } from '../shared/Badge'

export function Header() {
  return (
    <header className="app-header">
      <div>
        <div className="eyebrow">CFD Paper Mode</div>
        <h1>Global Broker AI v2</h1>
      </div>
      <div className="header-badges">
        <Badge tone="good">paperOnly=true</Badge>
        <Badge tone="good">realTradingAllowed=false</Badge>
        <Badge tone="good">brokerExecution=false</Badge>
      </div>
    </header>
  )
}
