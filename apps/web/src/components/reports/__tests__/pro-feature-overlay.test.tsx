import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProFeatureOverlay } from '../pro-feature-overlay';

describe('ProFeatureOverlay', () => {
  it('should render overlay with default title and description', () => {
    render(
      <ProFeatureOverlay>
        <div>Protected Content</div>
      </ProFeatureOverlay>
    );

    expect(screen.getByText('Recurso PRO')).toBeInTheDocument();
    expect(
      screen.getByText(/Faça upgrade para acessar relatórios detalhados/)
    ).toBeInTheDocument();
  });

  it('should render custom title and description', () => {
    render(
      <ProFeatureOverlay
        title="Custom Title"
        description="Custom description text"
      >
        <div>Protected Content</div>
      </ProFeatureOverlay>
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom description text')).toBeInTheDocument();
  });

  it('should render upgrade button with link', () => {
    render(
      <ProFeatureOverlay>
        <div>Protected Content</div>
      </ProFeatureOverlay>
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/settings/plan');
    expect(screen.getByText('Fazer Upgrade')).toBeInTheDocument();
  });

  it('should blur content when showContent is true', () => {
    const { container } = render(
      <ProFeatureOverlay showContent>
        <div>Blurred Content</div>
      </ProFeatureOverlay>
    );

    // The blurred content container should have blur class
    const blurredDiv = container.querySelector('.blur-sm');
    expect(blurredDiv).toBeInTheDocument();
  });

  it('should have hidden class when showContent is false', () => {
    const { container } = render(
      <ProFeatureOverlay showContent={false}>
        <div>Hidden Content</div>
      </ProFeatureOverlay>
    );

    // Content container should have hidden class
    const hiddenDiv = container.querySelector('.hidden');
    expect(hiddenDiv).toBeInTheDocument();
  });
});
