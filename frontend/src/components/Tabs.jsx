export function Tabs({ tabs = [], activeTab, onChange, className = '' }) {
  return (
    <div className={`tab-bar ${className}`} role="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id || activeTab === tab;
        const tabId = tab.id || tab;
        const label = tab.label || tab;

        return (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onChange(tabId)}
          >
            {tab.icon && <span className="tab-icon" aria-hidden="true">{tab.icon}</span>}
            <span>{label}</span>
            {tab.count !== undefined && (
              <span className="tab-count">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
