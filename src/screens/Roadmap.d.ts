import type { Textbook } from '../types';
interface RoadmapProps {
    textbook: Textbook;
    onBack: () => void;
    onSelectSection: (sectionId: string) => void;
}
export declare function Roadmap({ textbook, onBack, onSelectSection }: RoadmapProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=Roadmap.d.ts.map