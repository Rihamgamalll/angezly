import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Button } from '@/components/ui';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/** Preserve navigation and show a helpful Arabic message for render errors. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    console.error('[Dawrak] Unable to render route:', error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl px-5 py-16" dir="rtl">
          <Alert tone="error">تعذّر عرض هذا القسم بسبب خطأ تقني. لم تُحفظ أي تغييرات، ويمكنك إعادة فتح الصفحة أو إبلاغ إدارة دَوْرك بالخطأ.</Alert>
          <div className="mt-5">
            <Button type="button" onClick={() => window.location.reload()}>إعادة تحميل الصفحة</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
