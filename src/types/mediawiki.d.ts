interface Window {
  mw?: {
    config: {
      get: (key: string) => unknown;
    };
    util: {
      addPortletLink: (portletId: string, href: string, text: string, id?: string) => HTMLElement | null;
      wikiScript?: (name: string) => string;
    };
    Api?: new () => {
      get: (params: Record<string, any>) => Promise<any>;
      postWithToken: (tokenType: string, params: Record<string, any>) => Promise<any>;
    };
  };
}
