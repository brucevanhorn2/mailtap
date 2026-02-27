import type { ThemeConfig } from 'antd'

export const darkTheme: ThemeConfig = {
  token: {
    colorBgBase: '#141414',
    colorBgContainer: '#1c1c1e',
    colorBgElevated: '#242428',
    colorBgLayout: '#0f0f10',
    colorText: '#e2e2e2',
    colorTextSecondary: '#a0a0a8',
    colorBorder: '#2a2a2e',
    colorBorderSecondary: '#222226',
    colorPrimary: '#4f9eff',
    colorSuccess: '#52e05c',
    colorWarning: '#f5a623',
    colorError: '#ff5f5f',
    colorInfo: '#4f9eff',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 13,
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    lineHeight: 1.5,
    controlHeight: 32
  },
  components: {
    Layout: {
      siderBg: '#0f0f10',
      triggerBg: '#0f0f10',
      bodyBg: '#141414'
    },
    Tree: {
      nodeSelectedBg: '#1a2a3e',
      nodeHoverBg: '#1a1a1e',
      colorBgContainer: 'transparent'
    },
    Tabs: {
      itemColor: '#a0a0a8',
      itemSelectedColor: '#e2e2e2',
      inkBarColor: '#4f9eff'
    },
    Input: {
      colorBgContainer: '#1c1c1e',
      activeBorderColor: '#4f9eff',
      hoverBorderColor: '#3a3a3e'
    },
    Select: {
      colorBgContainer: '#1c1c1e',
      colorBgElevated: '#242428'
    },
    Button: {
      defaultBg: '#242428',
      defaultBorderColor: '#2a2a2e',
      defaultColor: '#e2e2e2'
    },
    Table: {
      colorBgContainer: 'transparent',
      headerBg: '#1a1a1e',
      rowHoverBg: '#1a1a1e'
    },
    Modal: {
      contentBg: '#1c1c1e',
      headerBg: '#1c1c1e'
    },
    Dropdown: {
      colorBgElevated: '#242428'
    },
    List: {
      colorBgContainer: 'transparent'
    }
  }
}
