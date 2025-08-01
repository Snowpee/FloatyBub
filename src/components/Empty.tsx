import { toast } from '../hooks/useToast';
import { cn } from "@/lib/utils";

// Empty component
export default function Empty() {
  return (
    <div className={cn("flex h-full items-center justify-center")} onClick={() => toast.info('Coming soon')}>Empty</div>
  );
}