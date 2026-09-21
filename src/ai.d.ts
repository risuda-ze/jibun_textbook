import { z } from 'zod';
export declare function setAPIKey(key: string): void;
export declare function hasAPIKey(): boolean;
export declare function askConfirmation(learning: string, current: string, time: string, tools: string): Promise<string[]>;
declare const CourseDesignSchema: z.ZodObject<{
    chapters: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        sections: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            goal: z.ZodString;
            estimatedTime: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            title: string;
            goal: string;
            estimatedTime: number;
        }, {
            title: string;
            goal: string;
            estimatedTime: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title: string;
        sections: {
            title: string;
            goal: string;
            estimatedTime: number;
        }[];
    }, {
        title: string;
        sections: {
            title: string;
            goal: string;
            estimatedTime: number;
        }[];
    }>, "many">;
    practiceExercises: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    chapters: {
        title: string;
        sections: {
            title: string;
            goal: string;
            estimatedTime: number;
        }[];
    }[];
    practiceExercises: string[];
}, {
    chapters: {
        title: string;
        sections: {
            title: string;
            goal: string;
            estimatedTime: number;
        }[];
    }[];
    practiceExercises: string[];
}>;
export declare function designCourse(learning: string, current: string, time: string, tools: string, answers: string): Promise<z.infer<typeof CourseDesignSchema>>;
export {};
//# sourceMappingURL=ai.d.ts.map