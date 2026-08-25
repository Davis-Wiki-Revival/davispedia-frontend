interface Window {
  mw: {
    config: {
      get: (key: string) => any;
    };
    util: {
      addPortletLink: (portletId: string, href: string, text: string, id?: string) => HTMLElement | null;
    };
    Api: new () => {
      get: (params: Record<string, any>) => Promise<any>;
      postWithToken: (tokenType: string, params: Record<string, any>) => Promise<any>;
    };
  };
}