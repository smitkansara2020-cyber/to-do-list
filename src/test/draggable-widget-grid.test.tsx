import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { DraggableWidgetGrid, type WidgetItem } from "@/components/ui/draggable-widget-grid";

interface TestWidget extends WidgetItem {
  title: string;
}

const TEST_ITEMS: TestWidget[] = [
  { id: "w1", size: "sm", label: "Widget 1", title: "Task Metrics" },
  { id: "w2", size: "wide", label: "Widget 2", title: "Throughput Minimap" },
  { id: "w3", size: "sm", label: "Widget 3", title: "Budget Tracker" },
];

describe("DraggableWidgetGrid component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders all widget items correctly with their titles and accessible labels", () => {
    render(
      <DraggableWidgetGrid
        items={TEST_ITEMS}
        renderItem={(item) => <div>{item.title}</div>}
      />,
    );

    expect(screen.getByText("Task Metrics")).toBeInTheDocument();
    expect(screen.getByText("Throughput Minimap")).toBeInTheDocument();
    expect(screen.getByText("Budget Tracker")).toBeInTheDocument();

    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(3);
    expect(articles[0]).toHaveAttribute("aria-label", "Widget 1");
  });

  it("restores order from localStorage when available", () => {
    localStorage.setItem(
      "test_grid_storage",
      JSON.stringify(["w3", "w1", "w2"]),
    );

    render(
      <DraggableWidgetGrid
        items={TEST_ITEMS}
        storageKey="test_grid_storage"
        renderItem={(item) => <div>{item.title}</div>}
      />,
    );

    const articles = screen.getAllByRole("article");
    expect(articles[0]).toHaveAttribute("aria-label", "Widget 3");
    expect(articles[1]).toHaveAttribute("aria-label", "Widget 1");
    expect(articles[2]).toHaveAttribute("aria-label", "Widget 2");
  });

  it("allows keyboard reordering with position buttons and updates localStorage", () => {
    render(
      <DraggableWidgetGrid
        items={TEST_ITEMS}
        showPositionControls
        storageKey="test_grid_storage"
        renderItem={(item) => <div>{item.title}</div>}
      />,
    );

    // Click "Move later" on first widget (w1)
    const moveLaterButtons = screen.getAllByTitle("Move later (Alt+Right)");
    fireEvent.click(moveLaterButtons[0]!);

    // Check localStorage was updated with new order: w2, w1, w3
    const saved = JSON.parse(localStorage.getItem("test_grid_storage") || "[]");
    expect(saved).toEqual(["w2", "w1", "w3"]);
  });

  it("handles keyboard Alt+Right arrow navigation to reorder items", () => {
    render(
      <DraggableWidgetGrid
        items={TEST_ITEMS}
        storageKey="test_grid_storage"
        renderItem={(item) => <div>{item.title}</div>}
      />,
    );

    const articles = screen.getAllByRole("article");
    fireEvent.keyDown(articles[0]!, { key: "ArrowRight", altKey: true });

    const saved = JSON.parse(localStorage.getItem("test_grid_storage") || "[]");
    expect(saved).toEqual(["w2", "w1", "w3"]);
  });

  it("dynamically adapts layout around dragged items on dragEnter", () => {
    render(
      <DraggableWidgetGrid
        items={TEST_ITEMS}
        storageKey="test_grid_storage"
        renderItem={(item) => <div>{item.title}</div>}
      />,
    );

    let articles = screen.getAllByRole("article");
    const dataTransfer = {
      setData: () => {},
      getData: () => "0",
      effectAllowed: "move",
      dropEffect: "move",
    };

    // Start dragging first item (w1)
    fireEvent.dragStart(articles[0]!, { dataTransfer });

    // Drag over third item (w3)
    fireEvent.dragEnter(articles[2]!, { dataTransfer });

    // Articles should reorder immediately
    articles = screen.getAllByRole("article");
    expect(articles[0]!).toHaveAttribute("aria-label", "Widget 2");
    expect(articles[1]!).toHaveAttribute("aria-label", "Widget 3");
    expect(articles[2]!).toHaveAttribute("aria-label", "Widget 1");

    // Complete drop
    fireEvent.drop(articles[2]!, { dataTransfer });
    const saved = JSON.parse(localStorage.getItem("test_grid_storage") || "[]");
    expect(saved).toEqual(["w2", "w3", "w1"]);
  });

  it("applies custom itemClassName function or string correctly", () => {
    render(
      <DraggableWidgetGrid
        items={TEST_ITEMS}
        itemClassName={(item) => (item.id === "w1" ? "custom-w1-class" : "custom-other-class")}
        renderItem={(item) => <div>{item.title}</div>}
      />,
    );

    const articles = screen.getAllByRole("article");
    expect(articles[0]).toHaveClass("custom-w1-class");
    expect(articles[1]).toHaveClass("custom-other-class");
    expect(articles[2]).toHaveClass("custom-other-class");
  });
});


