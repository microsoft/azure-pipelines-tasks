export interface PipelineBuild {
    _links: Links;
    url: string;
    id: number;
    name: string;
    result?: string,
    state: "completed" | "inProgress" | "notStarted" | "canceling";
}

interface Links {
    self: Link;
    web: Link;
}

interface Link {
    href: string;
}
